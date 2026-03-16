import encryption from '../encryption.js';

import { argon2idAsync } from '@noble/hashes/argon2';
import { randomBytes } from '@noble/hashes/utils';
import { base64url, hex } from '@scure/base';

export const PASSCODE_TYPES = Object.freeze({
  PIN: 'pin',
  PASSWORD: 'password',
});

export const PIN_LENGTH = 6;
export const PASSWORD_MIN_LENGTH = 8;

const PASSCODE_UNLOCK_CONFIG_VERSION = 1;
const PASSCODE_UNLOCK_PARAMS = Object.freeze({
  version: 0x13,
  t: 3,
  m: 64 * 1024,
  p: 1,
  dkLen: 32,
});
const PASSCODE_UNLOCK_RUNTIME_PARAMS = Object.freeze({
  ...PASSCODE_UNLOCK_PARAMS,
  asyncTick: 10,
});

function normalizePasscodeType(type) {
  if (!Object.values(PASSCODE_TYPES).includes(type)) {
    throw new TypeError('Unsupported passcode type');
  }
  return type;
}

function validatePasscode(passcode, type) {
  if (typeof passcode !== 'string') {
    throw new TypeError('passcode must be string');
  }
  const normalizedType = normalizePasscodeType(type);
  if (normalizedType === PASSCODE_TYPES.PIN) {
    if (!/^\d+$/.test(passcode) || passcode.length !== PIN_LENGTH) {
      throw new TypeError(`PIN must be exactly ${PIN_LENGTH} digits`);
    }
  } else if (passcode.length < PASSWORD_MIN_LENGTH) {
    throw new TypeError(`password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  return normalizedType;
}

function normalizePasscodeUnlockConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('Passcode unlock config must be an object');
  }
  if (config.kdf !== 'argon2id') {
    throw new TypeError('Unsupported passcode unlock KDF');
  }
  if (typeof config.salt !== 'string' || typeof config.wrappedDeviceSeed !== 'string') {
    throw new TypeError('Invalid passcode unlock config');
  }
  return {
    version: config.version || PASSCODE_UNLOCK_CONFIG_VERSION,
    type: normalizePasscodeType(config.type || PASSCODE_TYPES.PIN),
    kdf: config.kdf,
    salt: config.salt,
    wrappedDeviceSeed: config.wrappedDeviceSeed,
    params: {
      ...PASSCODE_UNLOCK_PARAMS,
      ...(config.params || {}),
    },
  };
}

async function derivePasscodeToken(passcode, config) {
  const normalized = normalizePasscodeUnlockConfig(config);
  validatePasscode(passcode, normalized.type);
  return argon2idAsync(passcode, base64url.decode(normalized.salt), {
    ...normalized.params,
    asyncTick: PASSCODE_UNLOCK_RUNTIME_PARAMS.asyncTick,
  });
}

export async function createPasscodeUnlockConfig(
  passcode,
  deviceSeed,
  type = PASSCODE_TYPES.PIN
) {
  const normalizedType = validatePasscode(passcode, type);
  if (!(deviceSeed instanceof Uint8Array)) {
    throw new TypeError('deviceSeed must be Uint8Array or Buffer');
  }
  const salt = randomBytes(16);
  const passcodeToken = await argon2idAsync(passcode, salt, PASSCODE_UNLOCK_RUNTIME_PARAMS);
  return {
    version: PASSCODE_UNLOCK_CONFIG_VERSION,
    type: normalizedType,
    kdf: 'argon2id',
    salt: base64url.encode(salt),
    params: { ...PASSCODE_UNLOCK_PARAMS },
    wrappedDeviceSeed: encryption.encrypt(hex.encode(deviceSeed), hex.encode(passcodeToken)),
  };
}

export async function unlockDeviceSeedWithPasscode(passcode, config) {
  const normalized = normalizePasscodeUnlockConfig(config);
  const passcodeToken = await derivePasscodeToken(passcode, normalized);
  return hex.decode(encryption.decrypt(normalized.wrappedDeviceSeed, hex.encode(passcodeToken)));
}

export default class PasscodeUnlock {
  #clientStorage;

  get isAvailable() {
    return true;
  }

  get isEnabled() {
    return this.#clientStorage.hasPasscodeUnlock();
  }

  get type() {
    const config = this.#clientStorage.getPasscodeUnlock();
    return normalizePasscodeType(config?.type || PASSCODE_TYPES.PIN);
  }

  constructor({ clientStorage }) {
    if (!clientStorage) {
      throw new TypeError('clientStorage is required');
    }
    this.#clientStorage = clientStorage;
  }

  async enable(deviceSeed, passcode, type = PASSCODE_TYPES.PIN) {
    try {
      this.#clientStorage.setPasscodeUnlock(
        await createPasscodeUnlockConfig(passcode, deviceSeed, type)
      );
      return true;
    } catch (error) {
      console.error(error);
      return false;
    }
  }

  async unlock(passcode) {
    const config = this.#clientStorage.getPasscodeUnlock();
    if (!config) {
      throw new Error('Passcode unlock is not configured');
    }
    return unlockDeviceSeedWithPasscode(passcode, config);
  }
}
