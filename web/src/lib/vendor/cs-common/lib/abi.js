function stripHexPrefix(value) {
  return value.startsWith('0x') ? value.slice(2) : value;
}

export function normalizeHex(value = '') {
  const normalized = stripHexPrefix(value.trim());
  if (normalized.length % 2 !== 0) {
    throw new TypeError('hex must have even length');
  }
  return normalized.toLowerCase();
}

export function hexToBytes(value = '') {
  const hex = normalizeHex(value);
  const chunks = hex.match(/.{1,2}/g) || [];
  return new Uint8Array(chunks.map((chunk) => parseInt(chunk, 16)));
}

export function decodeBytes32String(value = '') {
  const bytes = hexToBytes(value);
  const filtered = bytes.filter((byte) => byte !== 0);
  return new TextDecoder().decode(filtered).trim();
}

export function decodeAbiString(value = '') {
  const hex = normalizeHex(value);
  if (hex.length < 128) {
    return decodeBytes32String(hex);
  }
  const offset = Number(BigInt(`0x${hex.slice(0, 64)}`));
  const lengthIndex = offset * 2;
  if ((lengthIndex + 64) > hex.length) {
    return decodeBytes32String(hex);
  }
  const length = Number(BigInt(`0x${hex.slice(lengthIndex, lengthIndex + 64)}`));
  const valueIndex = lengthIndex + 64;
  const valueHex = hex.slice(valueIndex, valueIndex + (length * 2));
  if (!valueHex) {
    return '';
  }
  return new TextDecoder().decode(hexToBytes(valueHex)).trim();
}

export function decodeAbiUint(value = '') {
  const hex = normalizeHex(value);
  return Number(BigInt(`0x${hex || '0'}`));
}
