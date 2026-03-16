import encryption from '../encryption.js';

import { argon2idAsync } from '@noble/hashes/argon2';
import { randomBytes } from '@noble/hashes/utils';
import { base64url, hex } from '@scure/base';

const PIN_UNLOCK_CONFIG_VERSION = 1;
const PIN_UNLOCK_PARAMS = Object.freeze({
  version: 0x13,
  t: 3,
  m: 64 * 1024,
  p: 1,
  dkLen: 32,
});
const PIN_UNLOCK_RUNTIME_PARAMS = Object.freeze({
  ...PIN_UNLOCK_PARAMS,
  asyncTick: 10,
});

function normalizePinUnlockConfig(config) {
  if (!config || typeof config !== 'object') {
    throw new TypeError('PIN unlock config must be an object');
  }
  if (config.kdf !== 'argon2id') {
    throw new TypeError('Unsupported PIN unlock KDF');
  }
  if (typeof config.salt !== 'string' || typeof config.wrappedDeviceSeed !== 'string') {
    throw new TypeError('Invalid PIN unlock config');
  }
  return {
    version: config.version || PIN_UNLOCK_CONFIG_VERSION,
    kdf: config.kdf,
    salt: config.salt,
    wrappedDeviceSeed: config.wrappedDeviceSeed,
    params: {
      ...PIN_UNLOCK_PARAMS,
      ...(config.params || {}),
    },
  };
}

async function derivePinToken(pin, config) {
  if (typeof pin !== 'string') {
    throw new TypeError('pin must be string');
  }
  const { salt, params } = normalizePinUnlockConfig(config);
  return argon2idAsync(pin, base64url.decode(salt), {
    ...params,
    asyncTick: PIN_UNLOCK_RUNTIME_PARAMS.asyncTick,
  });
}

export function isPinUnlockConfig(config) {
  try {
    normalizePinUnlockConfig(config);
    return true;
  } catch {
    return false;
  }
}

export async function createPinUnlockConfig(pin, deviceSeed) {
  if (!(deviceSeed instanceof Uint8Array)) {
    throw new TypeError('deviceSeed must be Uint8Array or Buffer');
  }
  const salt = randomBytes(16);
  const pinToken = await argon2idAsync(pin, salt, PIN_UNLOCK_RUNTIME_PARAMS);
  return {
    version: PIN_UNLOCK_CONFIG_VERSION,
    kdf: 'argon2id',
    salt: base64url.encode(salt),
    params: { ...PIN_UNLOCK_PARAMS },
    wrappedDeviceSeed: encryption.encrypt(hex.encode(deviceSeed), hex.encode(pinToken)),
  };
}

export async function unlockDeviceSeedWithPin(pin, config) {
  const normalized = normalizePinUnlockConfig(config);
  const pinToken = await derivePinToken(pin, normalized);
  return hex.decode(encryption.decrypt(normalized.wrappedDeviceSeed, hex.encode(pinToken)));
}
