import { CsWallet } from '@coinspace/cs-common';

import BitcoinWallet from '@coinspace/cs-bitcoin-wallet';

import EvmWallet from '@coinspace/cs-evm-wallet';

import TronWallet from '@coinspace/cs-tron-wallet';

export const BITCOIN_FAMILY = [
  'bitcoin',
];

export const EVM_FAMILY = [
  'ethereum',
  'polygon',
];

export const SUPPORTED_PLATFORMS = [
  ...BITCOIN_FAMILY,
  ...EVM_FAMILY,
  'tron',
];

export const TOKEN_PLATFORMS = [
  'ethereum',
  'polygon',
  'tron',
];

export function getWalletModule(platform) {
  if (BITCOIN_FAMILY.includes(platform)) {
    return BitcoinWallet;
  }
  if (platform === 'tron') {
    return TronWallet;
  }
  if (EVM_FAMILY.includes(platform)) {
    return EvmWallet;
  }
  // fallback
  return CsWallet;
}

export async function loadWalletModule(platform) {
  return getWalletModule(platform);
}

function normalizeHost(host = '') {
  const value = host.trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) {
    return value.endsWith('/') ? value : `${value}/`;
  }
  return `https://${value}/`;
}

export function getBaseURL(service, isOnion) {
  const host = normalizeHost(isOnion ? import.meta.env.VITE_API_HOST_TOR : import.meta.env.VITE_API_HOST);
  if (!host) {
    return `/${service}/`;
  }
  switch (service) {
    case 'price':
    case 'swap':
      return new URL(`${service}/`, host).toString();
    default:
      return undefined;
  }
}
