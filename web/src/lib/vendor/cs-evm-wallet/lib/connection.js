import { connection } from '@coinspace/cs-common';

import { loadTokenInfo } from './token.js';
import networks from './networks.js';

const NODE_PRESETS = {
  ethereum: [
    {
      value: 'publicnode',
      name: 'PublicNode',
      baseURL: 'https://ethereum-rpc.publicnode.com/',
      historyBaseURL: 'https://eth.blockscout.com/api/v2/',
      apiType: 'evm-rpc',
    },
    {
      value: '1rpc',
      name: '1RPC',
      baseURL: 'https://1rpc.io/eth',
      historyBaseURL: 'https://eth.blockscout.com/api/v2/',
      apiType: 'evm-rpc',
    },
    { value: 'custom', name: 'Custom', baseURL: '', historyBaseURL: '', apiType: 'evm-rpc' },
  ],
  polygon: [
    {
      value: 'publicnode',
      name: 'PublicNode',
      baseURL: 'https://polygon-bor-rpc.publicnode.com/',
      historyBaseURL: 'https://polygon.blockscout.com/api/v2/',
      apiType: 'evm-rpc',
    },
    {
      value: '1rpc',
      name: '1RPC',
      baseURL: 'https://1rpc.io/matic',
      historyBaseURL: 'https://polygon.blockscout.com/api/v2/',
      apiType: 'evm-rpc',
    },
    { value: 'custom', name: 'Custom', baseURL: '', historyBaseURL: '', apiType: 'evm-rpc' },
  ],
};

const EXPLORER_PRESETS = {
  ethereum: [
    { value: 'etherscan', name: 'Etherscan', baseURL: 'https://etherscan.io/' },
    { value: 'blockscout', name: 'Blockscout', baseURL: 'https://eth.blockscout.com/' },
    { value: 'custom', name: 'Custom', baseURL: '' },
  ],
  polygon: [
    { value: 'polygonscan', name: 'PolygonScan', baseURL: 'https://polygonscan.com/' },
    { value: 'blockscout', name: 'Blockscout', baseURL: 'https://polygon.blockscout.com/' },
    { value: 'custom', name: 'Custom', baseURL: '' },
  ],
};

const EXPLORER_PATHS = {
  tx: 'tx/',
  address: 'address/',
  token: 'token/',
};

function getNodePresets(platform) {
  return NODE_PRESETS[platform] || [];
}

function getExplorerPresets(platform) {
  return EXPLORER_PRESETS[platform] || [];
}

function getNetwork(platform, development) {
  return networks[development ? 'testnet' : 'mainnet'][platform];
}

export function getChainLabel(platform) {
  return platform === 'polygon' ? 'Polygon' : 'Ethereum';
}

export function getDefaultNode(platform) {
  return normalizeNodeConfig(
    platform,
    connection.getDefaultPresetConfig(getNodePresets(platform), ['apiType', 'historyBaseURL'])
  );
}

export function getNodeOptions(platform) {
  return connection.getPresetOptions(getNodePresets(platform));
}

export function normalizeNodeConfig(platform, config = {}) {
  const normalized = connection.normalizePresetConfig(getNodePresets(platform), config, ['apiType', 'historyBaseURL']);
  return {
    ...normalized,
    historyBaseURL: connection.normalizeOptionalBaseURL(normalized.historyBaseURL),
  };
}

export function getDefaultExplorer(platform) {
  return connection.getDefaultPresetConfig(getExplorerPresets(platform));
}

export function getExplorerOptions(platform) {
  return connection.getPresetOptions(getExplorerPresets(platform));
}

export function normalizeExplorerConfig(platform, config = {}) {
  return connection.normalizePresetConfig(getExplorerPresets(platform), config);
}

export function buildExplorerUrl(platform, type, value, config = {}) {
  if (!value) return '';
  const path = EXPLORER_PATHS[type];
  if (!path) return '';
  const explorer = normalizeExplorerConfig(platform, config);
  return connection.joinExplorerURL(explorer.baseURL, `${path}${encodeURIComponent(value)}`);
}

export async function testNodeConnection(platform, config = {}, fetchFn) {
  const node = normalizeNodeConfig(platform, config);
  const network = getNetwork(platform, false);
  const fetch = connection.getFetch(fetchFn);
  const response = await fetch(node.baseURL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'eth_chainId',
      params: [],
      id: 1,
    }),
  });
  if (!response.ok) {
    throw new Error(`Unexpected status ${response.status}`);
  }
  const json = await response.json();
  const expected = `0x${network.chainId.toString(16)}`;
  if (json?.result !== expected) {
    throw new Error(`Unexpected chain id ${json?.result}`);
  }
  return {
    success: true,
    message: `Chain ID ${json.result}`,
  };
}

export async function getTokenInfo(platform, config, address, fetchFn) {
  const node = normalizeNodeConfig(platform, config);
  return loadTokenInfo(node.baseURL, address, fetchFn);
}
