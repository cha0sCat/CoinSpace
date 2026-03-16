import encryption from '../encryption.js';

import { randomBytes } from '@noble/hashes/utils';
import { hex } from '@scure/base';
import i18n from '../i18n/i18n.js';

export const TYPES = {
  BIOMETRICS: Symbol('BIOMETRICS'),
  FINGERPRINT: Symbol('FINGERPRINT'),
  TOUCH_ID: Symbol('TOUCH_ID'),
  FACE_ID: Symbol('FACE_ID'),
};

function normalizeBiometryConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('Biometry config must be an object');
  }
  if (typeof config.wrappedDeviceSeed !== 'string') {
    throw new TypeError('Invalid biometry config');
  }
  return {
    wrappedDeviceSeed: config.wrappedDeviceSeed,
  };
}

function wrapDeviceSeed(deviceSeed, secret) {
  if (!(deviceSeed instanceof Uint8Array)) {
    throw new TypeError('deviceSeed must be Uint8Array or Buffer');
  }
  if (typeof secret !== 'string') {
    throw new TypeError('biometry secret must be string');
  }
  return encryption.encrypt(hex.encode(deviceSeed), secret);
}

function unwrapDeviceSeed(wrappedDeviceSeed, secret) {
  if (typeof secret !== 'string') {
    throw new TypeError('biometry secret must be string');
  }
  return hex.decode(encryption.decrypt(wrappedDeviceSeed, secret));
}

export default class Biometry {
  #clientStorage;
  #isAvailable;
  #type;

  get isAvailable() {
    return this.#isAvailable;
  }

  get isEnabled() {
    if (!this.#isAvailable) return false;
    return this.#clientStorage.hasBiometry();
  }

  get type() {
    return this.#type;
  }

  constructor({ clientStorage }) {
    if (!clientStorage) {
      throw new TypeError('clientStorage is required');
    }
    this.#clientStorage = clientStorage;
  }

  async init() {
    let isAvailable = false;
    let type;

    try {
      if (import.meta.env.VITE_BUILD_TYPE === 'phonegap') {
        type = await new Promise((resolve) => {
          window.Fingerprint.isAvailable(
            (result) => resolve(result),
            () => resolve(false),
            { requireStrongBiometrics: true }
          );
        });
        isAvailable = !!type;
      } else {
        isAvailable = false;
      }
    } catch (err) {
      isAvailable = false;
    }

    if (isAvailable) {
      if (import.meta.env.VITE_BUILD_TYPE === 'phonegap') {
        if (type === 'face') {
          type = TYPES.FACE_ID;
        } else if (type === 'finger') {
          type = import.meta.env.VITE_PLATFORM === 'ios' ? TYPES.TOUCH_ID : TYPES.FINGERPRINT;
        } else if (type === 'biometric') {
          type = TYPES.BIOMETRICS;
        }
      } else {
        type = TYPES.BIOMETRICS;
      }
    }

    this.#isAvailable = isAvailable;
    this.#type = type;
  }

  async enable(deviceSeed) {
    try {
      if (import.meta.env.VITE_BUILD_TYPE !== 'phonegap') return false;
      const secret = hex.encode(randomBytes(32));
      await new Promise((resolve, reject) => {
        window.Fingerprint.registerBiometricSecret({
          description: import.meta.env.VITE_PLATFORM === 'ios' ? i18n.global.t('Scan your fingerprint please') : '',
          secret,
          invalidateOnEnrollment: true,
          fallbackButtonTitle: i18n.global.t('Cancel'),
          disableBackup: true,
        }, resolve, reject);
      });
      this.#clientStorage.setBiometry({
        wrappedDeviceSeed: wrapDeviceSeed(deviceSeed, secret),
      });
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  async disable() {
    try {
      this.#clientStorage.unsetBiometry();
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  async phonegap() {
    try {
      const secret = await new Promise((resolve, reject) => {
        window.Fingerprint.loadBiometricSecret({
          description: import.meta.env.VITE_PLATFORM === 'ios' ? i18n.global.t('Scan your fingerprint please') : '',
          fallbackButtonTitle: i18n.global.t('Cancel'),
          disableBackup: true,
        }, (secret) => resolve(secret), () => reject());
      });
      return secret;
    } catch (err) { /* empty */ }
  }

  async unlock() {
    const secret = await this.phonegap();
    if (!secret) return;
    const config = this.#clientStorage.getBiometry();
    if (!config) return;
    const normalized = normalizeBiometryConfig(config);
    return unwrapDeviceSeed(normalized.wrappedDeviceSeed, secret);
  }
}
