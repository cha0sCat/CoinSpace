import encryption from '../encryption.js';

import { argon2idAsync } from '@noble/hashes/argon2';
import { randomBytes } from '@noble/hashes/utils';
import { base64url, hex } from '@scure/base';

export const PASSWORD_MIN_LENGTH = 8;

const PASSWORD_UNLOCK_CONFIG_VERSION = 1;
const PASSWORD_UNLOCK_PARAMS = Object.freeze({
  version: 0x13,
  t: 3,
  m: 64 * 1024,
  p: 1,
  dkLen: 32,
});
const PASSWORD_UNLOCK_RUNTIME_PARAMS = Object.freeze({
  ...PASSWORD_UNLOCK_PARAMS,
  asyncTick: 10,
});

function normalizePasswordUnlockConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('Password unlock config must be an object');
  }
  if (config.kdf !== 'argon2id') {
    throw new TypeError('Unsupported password unlock KDF');
  }
  if (typeof config.salt !== 'string' || typeof config.wrappedDeviceSeed !== 'string') {
    throw new TypeError('Invalid password unlock config');
  }
  return {
    version: config.version || PASSWORD_UNLOCK_CONFIG_VERSION,
    kdf: config.kdf,
    salt: config.salt,
    wrappedDeviceSeed: config.wrappedDeviceSeed,
    params: {
      ...PASSWORD_UNLOCK_PARAMS,
      ...(config.params || {}),
    },
  };
}

async function derivePasswordToken(password, config) {
  if (typeof password !== 'string') {
    throw new TypeError('password must be string');
  }
  const { salt, params } = normalizePasswordUnlockConfig(config);
  return argon2idAsync(password, base64url.decode(salt), {
    ...params,
    asyncTick: PASSWORD_UNLOCK_RUNTIME_PARAMS.asyncTick,
  });
}

async function createPasswordUnlockConfig(password, deviceSeed) {
  if (typeof password !== 'string') {
    throw new TypeError('password must be string');
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new TypeError(`password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (!(deviceSeed instanceof Uint8Array)) {
    throw new TypeError('deviceSeed must be Uint8Array or Buffer');
  }
  const salt = randomBytes(16);
  const passwordToken = await argon2idAsync(password, salt, PASSWORD_UNLOCK_RUNTIME_PARAMS);
  return {
    version: PASSWORD_UNLOCK_CONFIG_VERSION,
    kdf: 'argon2id',
    salt: base64url.encode(salt),
    params: { ...PASSWORD_UNLOCK_PARAMS },
    wrappedDeviceSeed: encryption.encrypt(hex.encode(deviceSeed), hex.encode(passwordToken)),
  };
}

export default class PasswordUnlock {
  #clientStorage;

  get isAvailable() {
    return true;
  }

  get isEnabled() {
    return this.#clientStorage.hasPasswordUnlock();
  }

  constructor({ clientStorage }) {
    if (!clientStorage) {
      throw new TypeError('clientStorage is required');
    }
    this.#clientStorage = clientStorage;
  }

  async enable(deviceSeed, password) {
    try {
      this.#clientStorage.setPasswordUnlock(await createPasswordUnlockConfig(password, deviceSeed));
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  async disable() {
    try {
      this.#clientStorage.unsetPasswordUnlock();
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  async unlock(password) {
    const config = this.#clientStorage.getPasswordUnlock();
    if (!config) {
      throw new Error('Password unlock is not enabled');
    }
    const normalized = normalizePasswordUnlockConfig(config);
    const passwordToken = await derivePasswordToken(password, normalized);
    return hex.decode(encryption.decrypt(normalized.wrappedDeviceSeed, hex.encode(passwordToken)));
  }
}
