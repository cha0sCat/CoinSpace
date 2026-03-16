import encryption from '../encryption.js';

import { hmac } from '@noble/hashes/hmac';
import { randomBytes } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';
import { base64url, hex } from '@scure/base';

const TIMEOUT = 60000;

function ensureBytes(value, message = 'value must be bytes') {
  if (value instanceof Uint8Array) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Uint8Array(value);
  }
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new TypeError(message);
}

function isUserCancelled(error) {
  return ['AbortError', 'NotAllowedError'].includes(error?.name);
}

function derivePrfToken(output) {
  return hmac(sha256, 'Coin Wallet WebAuthn', ensureBytes(output, 'prf output must be bytes'));
}

function getPrfResult(credential) {
  const results = credential?.getClientExtensionResults?.();
  const first = results?.prf?.results?.first;
  return first ? ensureBytes(first, 'prf result must be bytes') : undefined;
}

function wrapDeviceSeed(deviceSeed, prfOutput) {
  const token = derivePrfToken(prfOutput);
  return encryption.encrypt(hex.encode(deviceSeed), hex.encode(token));
}

function unwrapDeviceSeed(wrappedDeviceSeed, prfOutput) {
  const token = derivePrfToken(prfOutput);
  return hex.decode(encryption.decrypt(wrappedDeviceSeed, hex.encode(token)));
}

function getPublicKeyCredential() {
  return window.PublicKeyCredential;
}

function getNavigatorCredentials() {
  return window.navigator?.credentials;
}

export default class WebAuthnUnlock {
  #clientStorage;
  #appName;
  #isAvailable = false;

  get isAvailable() {
    return this.#isAvailable;
  }

  get isEnabled() {
    if (!this.#isAvailable) return false;
    return this.#clientStorage.hasWebAuthn();
  }

  constructor({ clientStorage, appName }) {
    if (!clientStorage) {
      throw new TypeError('clientStorage is required');
    }
    this.#clientStorage = clientStorage;
    this.#appName = appName || 'Wallet';
  }

  async init() {
    let isAvailable = false;
    try {
      const PublicKeyCredential = getPublicKeyCredential();
      const credentials = getNavigatorCredentials();
      isAvailable = !!(
        window.isSecureContext &&
        PublicKeyCredential &&
        credentials?.create &&
        credentials?.get
      );
      if (isAvailable && typeof PublicKeyCredential.getClientCapabilities === 'function') {
        const capabilities = await PublicKeyCredential.getClientCapabilities();
        if (capabilities?.['extension:prf'] === false) {
          isAvailable = false;
        }
      }
    } catch {
      isAvailable = false;
    }
    this.#isAvailable = isAvailable;
  }

  async enable(deviceSeed) {
    if (!(deviceSeed instanceof Uint8Array)) {
      throw new TypeError('deviceSeed must be Uint8Array or Buffer');
    }
    try {
      const config = await this.#register(deviceSeed);
      this.#clientStorage.setWebAuthn(config);
      return true;
    } catch (error) {
      if (!isUserCancelled(error)) {
        console.error(error);
      }
      return false;
    }
  }

  async disable() {
    try {
      this.#clientStorage.unsetWebAuthn();
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  async unlock() {
    const config = this.#clientStorage.getWebAuthn();
    if (!config) {
      throw new Error('WebAuthn is not enabled');
    }
    try {
      const prfOutput = await this.#evaluate(config);
      return unwrapDeviceSeed(config.wrappedDeviceSeed, prfOutput);
    } catch (error) {
      if (isUserCancelled(error)) {
        return undefined;
      }
      throw error;
    }
  }

  async #register(deviceSeed) {
    const credentials = getNavigatorCredentials();
    const userId = this.#getUserId();
    const publicKey = {
      challenge: randomBytes(32),
      rp: {
        name: this.#appName,
      },
      user: {
        id: userId,
        name: this.#clientStorage.getId() || this.#appName,
        displayName: this.#appName,
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      timeout: TIMEOUT,
      attestation: 'none',
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
      },
      extensions: {
        prf: {},
      },
    };
    const credential = await credentials.create({ publicKey });
    const credentialId = base64url.encode(ensureBytes(credential.rawId, 'credential id must be bytes'));
    const prfSalt = randomBytes(32);
    const prfOutput = await this.#evaluate({
      credentialId,
      prfSalt: base64url.encode(prfSalt),
      transports: credential.response?.getTransports?.() || [],
    });

    if (!prfOutput) {
      throw new Error('WebAuthn PRF result is missing');
    }

    return {
      credentialId,
      transports: credential.response?.getTransports?.() || [],
      prfSalt: base64url.encode(prfSalt),
      wrappedDeviceSeed: wrapDeviceSeed(deviceSeed, prfOutput),
    };
  }

  async #evaluate(config) {
    const credentials = getNavigatorCredentials();
    const { credentialId } = config;
    const prfSalt = base64url.decode(config.prfSalt);
    const publicKey = {
      challenge: randomBytes(32),
      timeout: TIMEOUT,
      userVerification: 'required',
      allowCredentials: [{
        type: 'public-key',
        id: base64url.decode(credentialId),
        transports: config.transports?.length ? config.transports : undefined,
      }],
      extensions: {
        prf: {
          evalByCredential: {
            [credentialId]: {
              first: prfSalt,
            },
          },
        },
      },
    };
    const credential = await credentials.get({ publicKey });
    const result = getPrfResult(credential);
    if (!result) {
      throw new Error('WebAuthn PRF is not supported by this credential');
    }
    return result;
  }

  #getUserId() {
    if (this.#clientStorage.hasId()) {
      return hex.decode(this.#clientStorage.getId());
    }
    return randomBytes(32);
  }
}
