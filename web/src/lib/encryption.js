import { base64 } from '@scure/base';
import { cbc } from '@noble/ciphers/aes.js';
import { xchacha20poly1305 } from '@noble/ciphers/chacha.js';
import { md5 } from '@noble/hashes/legacy.js';
import { sha256 } from '@noble/hashes/sha256';
import {
  abytes,
  bytesToUtf8,
  concatBytes,
  randomBytes,
  utf8ToBytes,
} from '@noble/hashes/utils.js';

const ENCRYPTION_V2_PREFIX = 'cs2:';
const ENCRYPTION_V2_AAD = utf8ToBytes('coinwallet:v2');
const ENCRYPTION_V2_NONCE_LENGTH = 24;

export function evpBytesToKey(password, salt = new Uint8Array(0), keyLen = 32, ivLen = 16, count = 1) {
  abytes(password);
  abytes(salt, 0, 8);
  let derived = new Uint8Array(0);
  let block = new Uint8Array(0);

  while (derived.length < (keyLen + ivLen)) {
    block = md5(concatBytes(block, password, salt));
    for (let i = 1; i < count; i++) {
      block = md5(block);
    }
    derived = concatBytes(derived, block);
  }

  return {
    key: derived.slice(0, keyLen),
    iv: derived.slice(keyLen, keyLen + ivLen),
  };
}

function deriveEncryptionKey(password) {
  return sha256(utf8ToBytes(password));
}

function decryptLegacy(data, password) {
  const encrypted = base64.decode(data);
  const salt = encrypted.slice(8, 16);
  const { key, iv } = evpBytesToKey(utf8ToBytes(password), salt, 32, 16);
  return bytesToUtf8(cbc(key, iv).decrypt(encrypted.slice(16)));
}

export function encrypt(data, password) {
  if (typeof data !== 'string') {
    throw new TypeError('data must be a string');
  }
  if (typeof password !== 'string') {
    throw new TypeError('key must be a string');
  }
  const nonce = randomBytes(ENCRYPTION_V2_NONCE_LENGTH);
  const key = deriveEncryptionKey(password);
  const encrypted = xchacha20poly1305(key, nonce, ENCRYPTION_V2_AAD).encrypt(utf8ToBytes(data));
  return `${ENCRYPTION_V2_PREFIX}${base64.encode(concatBytes(nonce, encrypted))}`;
}

export function decrypt(data, password) {
  if (typeof data !== 'string') {
    throw new TypeError('data must be a string');
  }
  if (typeof password !== 'string') {
    throw new TypeError('key must be a string');
  }
  if (data.startsWith(ENCRYPTION_V2_PREFIX)) {
    const encrypted = base64.decode(data.slice(ENCRYPTION_V2_PREFIX.length));
    const nonce = encrypted.slice(0, ENCRYPTION_V2_NONCE_LENGTH);
    const ciphertext = encrypted.slice(ENCRYPTION_V2_NONCE_LENGTH);
    const key = deriveEncryptionKey(password);
    return bytesToUtf8(xchacha20poly1305(key, nonce, ENCRYPTION_V2_AAD).decrypt(ciphertext));
  }
  return decryptLegacy(data, password);
}

export function encryptJSON(json, key) {
  return encrypt(JSON.stringify(json), key);
}

export function decryptJSON(text, key) {
  return JSON.parse(decrypt(text, key));
}

export default {
  encrypt,
  encryptJSON,
  decrypt,
  decryptJSON,
};
