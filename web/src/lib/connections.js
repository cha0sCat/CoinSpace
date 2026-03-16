import { deepFreeze } from './helpers.js';
import { SUPPORTED_PLATFORMS, getWalletModule } from './constants.js';

export const CHAIN_LABELS = deepFreeze(SUPPORTED_PLATFORMS.reduce((labels, platform) => {
  labels[platform] = getWalletModule(platform).getChainLabel(platform);
  return labels;
}, {}));

export function getDefaultNode(platform) {
  return getWalletModule(platform).getDefaultNode(platform);
}

export function getNodeOptions(platform) {
  return getWalletModule(platform).getNodeOptions(platform);
}

export function normalizeNodeConfig(platform, config = {}) {
  return getWalletModule(platform).normalizeNodeConfig(platform, config);
}

export function getDefaultExplorer(platform) {
  return getWalletModule(platform).getDefaultExplorer(platform);
}

export function getExplorerOptions(platform) {
  return getWalletModule(platform).getExplorerOptions(platform);
}

export function normalizeExplorerConfig(platform, config = {}) {
  return getWalletModule(platform).normalizeExplorerConfig(platform, config);
}

export function buildExplorerUrl(platform, type, value, config = {}) {
  return getWalletModule(platform).buildExplorerUrl(platform, type, value, config);
}

export async function testNodeConnection(platform, config = {}, fetchFn) {
  return getWalletModule(platform).testNodeConnection(platform, config, fetchFn);
}

export async function getTokenInfo(platform, config, address, fetchFn) {
  return getWalletModule(platform).getTokenInfo(platform, config, address, fetchFn);
}
