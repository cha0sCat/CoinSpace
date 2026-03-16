import { connection } from '@coinspace/cs-common';

const NODE_PRESETS = [
  { value: 'blockstream', name: 'Blockstream', baseURL: 'https://blockstream.info/api/', apiType: 'esplora' },
  { value: 'mempool', name: 'mempool.space', baseURL: 'https://mempool.space/api/', apiType: 'esplora' },
  { value: 'custom', name: 'Custom', baseURL: '', apiType: 'esplora' },
];

const EXPLORER_PRESETS = [
  { value: 'blockstream', name: 'Blockstream', baseURL: 'https://blockstream.info/' },
  { value: 'mempool', name: 'mempool.space', baseURL: 'https://mempool.space/' },
  { value: 'custom', name: 'Custom', baseURL: '' },
];

const EXPLORER_PATHS = {
  tx: 'tx/',
  address: 'address/',
};

export function getChainLabel() {
  return 'Bitcoin';
}

export function getDefaultNode() {
  return connection.getDefaultPresetConfig(NODE_PRESETS, ['apiType']);
}

export function getNodeOptions() {
  return connection.getPresetOptions(NODE_PRESETS);
}

export function normalizeNodeConfig(config = {}) {
  return connection.normalizePresetConfig(NODE_PRESETS, config, ['apiType']);
}

export function getDefaultExplorer() {
  return connection.getDefaultPresetConfig(EXPLORER_PRESETS);
}

export function getExplorerOptions() {
  return connection.getPresetOptions(EXPLORER_PRESETS);
}

export function normalizeExplorerConfig(config = {}) {
  return connection.normalizePresetConfig(EXPLORER_PRESETS, config);
}

export function buildExplorerUrl(type, value, config = {}) {
  if (!value) return '';
  const path = EXPLORER_PATHS[type];
  if (!path) return '';
  const explorer = normalizeExplorerConfig(config);
  return connection.joinExplorerURL(explorer.baseURL, `${path}${encodeURIComponent(value)}`);
}

export async function testNodeConnection(config = {}, fetchFn) {
  const node = normalizeNodeConfig(config);
  const fetch = connection.getFetch(fetchFn);
  const response = await fetch(new URL('blocks/tip/height', node.baseURL), {
    method: 'GET',
  });
  if (!response.ok) {
    throw new Error(`Unexpected status ${response.status}`);
  }
  const text = (await response.text()).trim();
  if (!/^\d+$/.test(text)) {
    throw new Error('Invalid tip height');
  }
  return {
    success: true,
    message: `Tip height ${text}`,
  };
}
