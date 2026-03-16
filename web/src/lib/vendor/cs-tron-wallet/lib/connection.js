import { connection } from '@coinspace/cs-common';

import { loadTokenInfo } from './token.js';

const NODE_PRESETS = [
  {
    value: 'publicnode',
    name: 'PublicNode',
    baseURL: 'https://tron-rpc.publicnode.com/',
    historyBaseURL: 'https://api.trongrid.io/',
    apiType: 'tron-http',
  },
  {
    value: 'trongrid',
    name: 'TronGrid',
    baseURL: 'https://api.trongrid.io/',
    historyBaseURL: 'https://api.trongrid.io/',
    apiType: 'tron-http',
  },
  { value: 'custom', name: 'Custom', baseURL: '', historyBaseURL: '', apiType: 'tron-http' },
];

const EXPLORER_PRESETS = [
  { value: 'tronscan', name: 'Tronscan', baseURL: 'https://tronscan.org/#/' },
  { value: 'custom', name: 'Custom', baseURL: '' },
];

const EXPLORER_PATHS = {
  tx: 'transaction/',
  address: 'address/',
  token: 'token20/',
};

export function getChainLabel() {
  return 'Tron';
}

export function getDefaultNode() {
  return normalizeNodeConfig(connection.getDefaultPresetConfig(NODE_PRESETS, ['apiType', 'historyBaseURL']));
}

export function getNodeOptions() {
  return connection.getPresetOptions(NODE_PRESETS);
}

export function normalizeNodeConfig(config = {}) {
  const normalized = connection.normalizePresetConfig(NODE_PRESETS, config, ['apiType', 'historyBaseURL']);
  return {
    ...normalized,
    historyBaseURL: connection.normalizeOptionalBaseURL(normalized.historyBaseURL),
  };
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
  const response = await fetch(new URL('wallet/getnowblock', node.baseURL), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: '{}',
  });
  if (!response.ok) {
    throw new Error(`Unexpected status ${response.status}`);
  }
  const json = await response.json();
  const height = json?.block_header?.raw_data?.number;
  if (!json?.blockID || typeof height !== 'number') {
    throw new Error('Invalid block response');
  }
  return {
    success: true,
    message: `Block ${height}`,
  };
}

export async function getTokenInfo(platform, config, address, fetchFn) {
  void platform;
  const node = normalizeNodeConfig(config);
  return loadTokenInfo(node.baseURL, address, fetchFn);
}
