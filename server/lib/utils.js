import Big from 'big.js';
import crypto from 'node:crypto';

export function normalizeNumber(n, decimals) {
  return Big(n).round(decimals ?? 8).toFixed();
}

export function getUserId(walletId, salt) {
  return crypto
    .createHmac('sha256', salt)
    .update(walletId)
    .digest('hex');
}
