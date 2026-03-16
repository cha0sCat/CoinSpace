import { Amount } from '@coinspace/cs-common';
import { SUPPORTED_PLATFORMS, getWalletModule } from '../src/lib/constants.js';

import Request from '../src/lib/account/Request.js';

import process from 'node:process';

import staticCryptos from '../src/lib/staticCryptos.js';

const TOKEN_SMOKE = Object.freeze({
  ethereum: {
    address: '0xA0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    symbol: 'USDC',
    decimals: 6,
  },
  polygon: {
    address: '0x3c499c542cef5e3811e1192ce70d8cc03d5c3359',
    symbol: 'USDC',
    decimals: 6,
  },
  tron: {
    address: 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    symbol: 'USDT',
    decimals: 6,
  },
});

class MemoryStore {
  #map = new Map();

  get(key) {
    return this.#map.get(key);
  }

  set(key, value) {
    this.#map.set(key, value);
  }

  async save() {}
}

function parseRequestedChains(argv) {
  const arg = argv.find((item) => item.startsWith('--chains='));
  const source = process.env.SMOKE_CHAINS || arg?.slice('--chains='.length) || '';
  if (!source) {
    return new Set(SUPPORTED_PLATFORMS);
  }
  return new Set(source.split(',').map((item) => item.trim()).filter(Boolean));
}

function getCoin(platform) {
  return staticCryptos.find((item) => item.platform === platform && item.type === 'coin');
}

function createSeed(platform) {
  const bytes = new Uint8Array(64);
  for (let i = 0; i < bytes.length; i++) {
    const code = platform.charCodeAt(i % platform.length);
    bytes[i] = (code + (i * 29)) % 256;
  }
  return bytes;
}

function createRequest() {
  const requestClient = new Request({
    clientStorage: {
      getId() {
        return 'smoke';
      },
    },
    release: 'smoke',
  });
  return requestClient.request.bind(requestClient);
}

function createWallet({ Wallet, coin, node, request }) {
  return new Wallet({
    crypto: coin,
    platform: { ...coin },
    settings: {},
    request,
    apiNode: node.baseURL,
    connection: {
      node,
      explorer: Wallet.getDefaultExplorer(coin.platform),
    },
    cache: new MemoryStore(),
    storage: new MemoryStore(),
    txPerPage: 10,
  });
}

async function resolveNode({ Wallet, platform }) {
  const attempts = [];
  const candidates = Wallet.getNodeOptions(platform)
    .filter((item) => item.value !== 'custom')
    .map((item) => Wallet.normalizeNodeConfig(platform, { preset: item.value }));

  for (const node of candidates) {
    try {
      const result = await Wallet.testNodeConnection(platform, node, fetch);
      attempts.push({
        node: node.baseURL,
        success: true,
        message: result?.message,
      });
      return {
        node,
        attempts,
      };
    } catch (error) {
      attempts.push({
        node: node.baseURL,
        success: false,
        message: error?.message || String(error),
      });
    }
  }

  const error = new Error(`No healthy node preset for ${platform}`);
  error.attempts = attempts;
  throw error;
}

async function runBitcoinFeeSmoke(wallet) {
  await wallet.loadFeeRates();
  return {
    feeRates: wallet.feeRates.map((item) => item.description),
  };
}

async function runTokenSmoke(platform, Wallet, node) {
  const token = TOKEN_SMOKE[platform];
  if (!token) {
    return undefined;
  }
  const info = await Wallet.getTokenInfo(platform, node, token.address, fetch);
  if (info.symbol !== token.symbol) {
    throw new Error(`Unexpected token symbol for ${platform}: ${info.symbol}`);
  }
  if (info.decimals !== token.decimals) {
    throw new Error(`Unexpected token decimals for ${platform}: ${info.decimals}`);
  }
  return {
    tokenAddress: token.address,
    tokenSymbol: info.symbol,
    tokenDecimals: info.decimals,
  };
}

async function runChainSmoke(platform) {
  const coin = getCoin(platform);
  if (!coin) {
    throw new Error(`Missing coin definition for ${platform}`);
  }
  const Wallet = await getWalletModule(platform);
  const { node, attempts } = await resolveNode({ Wallet, platform });
  const request = createRequest();
  const seed = createSeed(platform);

  const createdWallet = createWallet({ Wallet, coin, node, request });
  await createdWallet.create(seed);
  const publicKey = createdWallet.getPublicKey();

  const wallet = createWallet({ Wallet, coin, node, request });
  await wallet.open(publicKey);
  await wallet.load();

  await wallet.validateAddress({ address: wallet.dummyExchangeDepositAddress });
  const history = await wallet.loadTransactions();

  let feeSmoke;
  if (platform === 'bitcoin') {
    feeSmoke = await runBitcoinFeeSmoke(wallet);
  } else if (wallet.isGasLimitSupported) {
    const fee = await wallet.estimateTransactionFee({
      gasLimit: wallet.gasLimit,
      address: wallet.dummyExchangeDepositAddress,
      amount: new Amount(1n, coin.decimals),
    });
    feeSmoke = { estimatedFee: fee.value.toString() };
  } else {
    const fee = await wallet.estimateTransactionFee({
      address: wallet.dummyExchangeDepositAddress,
      amount: new Amount(1n, coin.decimals),
    });
    feeSmoke = { estimatedFee: fee.value.toString() };
  }

  const tokenSmoke = await runTokenSmoke(platform, Wallet, node);

  return {
    chain: platform,
    node: node.baseURL,
    attempts,
    address: wallet.address,
    balance: wallet.balance.value.toString(),
    historyCount: history.transactions.length,
    historyHasMore: history.hasMore,
    ...feeSmoke,
    ...tokenSmoke,
  };
}

async function main() {
  const requestedChains = parseRequestedChains(process.argv.slice(2));
  const chains = SUPPORTED_PLATFORMS.filter((platform) => requestedChains.has(platform));
  const results = [];
  let hasFailure = false;

  for (const platform of chains) {
    try {
      const result = await runChainSmoke(platform);
      results.push({
        ok: true,
        ...result,
      });
    } catch (error) {
      hasFailure = true;
      results.push({
        ok: false,
        chain: platform,
        error: error?.message || String(error),
        attempts: error?.attempts || [],
      });
    }
  }

  for (const result of results) {
    console.log(JSON.stringify(result));
  }

  if (hasFailure) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
