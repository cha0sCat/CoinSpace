import { EXCHANGE_PROVIDERS } from './metadata.js';

import { fileURLToPath } from 'url';

import Big from 'big.js';

import axios from 'axios';

import axiosRetry from 'axios-retry';

import createError from 'http-errors';

import cryptoDB from '@coinspace/crypto-db';

import exchanges from '../exchanges/index.js';

import express from 'express';

const coingecko = axios.create({
  baseURL: 'https://api.coingecko.com/api/v3/',
  timeout: 30000,
});

axiosRetry(coingecko, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay,
  shouldResetTimeout: true,
  retryCondition(error) {
    return axiosRetry.isNetworkOrIdempotentRequestError(error)
      || error.response?.status === 429;
  },
});

const providerLogoPath = fileURLToPath(new URL('../../assets/providers', import.meta.url));

function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (err) {
      next(err);
    }
  };
}

function listParam(value) {
  if (Array.isArray(value)) {
    value = value.join(',');
  }
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeCurrency(value) {
  return String(value || 'usd').trim().toLowerCase();
}

function resolveCrypto(id) {
  if (!id) return;
  const exact = cryptoDB.find((item) => item._id === id);
  if (exact) return exact;
  const [asset, platform] = String(id).split('@');
  if (asset && platform) {
    return cryptoDB.find((item) => item.asset === asset && item.platform === platform);
  }
  return cryptoDB.find((item) => item.asset === id);
}

function normalizeChange(value) {
  return Number.isFinite(value) ? value : 0;
}

function mapMarketItem(cryptoId, market) {
  return {
    cryptoId,
    price: market.current_price ?? 0,
    price_change_1d: normalizeChange(market.price_change_percentage_24h_in_currency),
    price_change_7d: normalizeChange(market.price_change_percentage_7d_in_currency),
    price_change_14d: normalizeChange(market.price_change_percentage_14d_in_currency),
    price_change_1m: normalizeChange(market.price_change_percentage_30d_in_currency),
    price_change_1y: normalizeChange(market.price_change_percentage_1y_in_currency),
  };
}

function estimateError(errors = []) {
  if (errors.some((item) => item.error === 'AmountError')) {
    return { error: 'AmountError' };
  }

  const smallAmounts = errors
    .filter((item) => item.error === 'SmallAmountError' && item.amount)
    .map((item) => item.amount);
  if (smallAmounts.length) {
    const amount = smallAmounts.reduce((result, item) => {
      return Big(item).lt(result) ? item : result;
    });
    return { error: 'SmallAmountError', amount };
  }

  const bigAmounts = errors
    .filter((item) => item.error === 'BigAmountError' && item.amount)
    .map((item) => item.amount);
  if (bigAmounts.length) {
    const amount = bigAmounts.reduce((result, item) => {
      return Big(item).gt(result) ? item : result;
    });
    return { error: 'BigAmountError', amount };
  }

  if (errors.some((item) => item.error === 'ExchangeDisabled')) {
    return { error: 'ExchangeDisabled' };
  }
}

function getWalletId(req) {
  return String(req.query.walletId || req.query.id || 'public');
}

function getExchangeOrThrow(id) {
  const exchange = exchanges[id];
  const metadata = EXCHANGE_PROVIDERS[id];
  if (!exchange || !metadata) {
    throw createError(404, 'Exchange provider not configured');
  }
  return { exchange, metadata };
}

export const priceApi = express.Router();
export const swapApi = express.Router();

priceApi.get('/api/v1/prices', asyncHandler(async (req, res) => {
  const ids = listParam(req.query.cryptoIds);
  if (!ids.length) {
    return res.status(200).send([]);
  }
  const currency = normalizeCurrency(req.query.fiat);
  const resolved = ids.map((id) => {
    const crypto = resolveCrypto(id);
    return crypto?.coingecko?.id ? { cryptoId: id, coingeckoId: crypto.coingecko.id } : undefined;
  }).filter(Boolean);
  if (!resolved.length) {
    return res.status(200).send([]);
  }

  const coingeckoIds = [...new Set(resolved.map((item) => item.coingeckoId))];
  const { data } = await coingecko.get('coins/markets', {
    params: {
      vs_currency: currency,
      ids: coingeckoIds.join(','),
      price_change_percentage: '24h,7d,14d,30d,1y',
    },
  });
  const marketByCoingeckoId = new Map(data.map((item) => [item.id, item]));
  const result = resolved.map(({ cryptoId, coingeckoId }) => {
    const item = marketByCoingeckoId.get(coingeckoId);
    if (!item) return;
    return mapMarketItem(cryptoId, item);
  }).filter(Boolean);
  res.status(200).send(result);
}));

priceApi.get('/api/v1/chart/:id', asyncHandler(async (req, res) => {
  const crypto = resolveCrypto(req.params.id);
  if (!crypto?.coingecko?.id) {
    return res.status(200).send([]);
  }
  const currency = normalizeCurrency(req.query.fiat);
  const days = Number.parseInt(req.query.days, 10);
  const { data } = await coingecko.get(`coins/${crypto.coingecko.id}/market_chart`, {
    params: {
      vs_currency: currency,
      days: Number.isFinite(days) && days > 0 ? days : 1,
    },
  });
  const result = (data.prices || []).map(([bucket, price]) => {
    return {
      bucket: new Date(bucket).toISOString(),
      price,
    };
  }).reverse();
  res.status(200).send(result);
}));

swapApi.get('/api/v1/providers', asyncHandler(async (_, res) => {
  const providers = Object.values(EXCHANGE_PROVIDERS)
    .filter((provider) => !!exchanges[provider.id]);
  res.status(200).send(providers);
}));

swapApi.get('/api/v1/estimate', asyncHandler(async (req, res) => {
  const providers = Object.keys(EXCHANGE_PROVIDERS).filter((provider) => !!exchanges[provider]);
  const results = [];
  const typedErrors = [];
  let internalFailures = 0;

  await Promise.all(providers.map(async (provider) => {
    try {
      const result = await exchanges[provider].estimate({
        from: req.query.from,
        to: req.query.to,
        amount: req.query.amount,
      });
      if (result?.error) {
        typedErrors.push(result);
        return;
      }
      if (!result?.result) {
        return;
      }
      results.push({
        provider,
        ...result,
      });
    } catch (err) {
      internalFailures += 1;
      console.error(`${provider} estimate failed`, err.message);
    }
  }));

  if (results.length) {
    results.sort((left, right) => Big(right.result).cmp(left.result));
    return res.status(200).send(results);
  }

  const error = estimateError(typedErrors);
  if (error) {
    return res.status(200).send(error);
  }
  if (internalFailures && internalFailures === providers.length) {
    throw createError(502, 'Unable to estimate exchange');
  }
  return res.status(200).send({ error: 'ExchangeDisabled' });
}));

swapApi.get('/api/v1/validate/:provider', asyncHandler(async (req, res) => {
  const { exchange } = getExchangeOrThrow(req.params.provider);
  const result = await exchange.validateAddress({
    cryptoId: req.query.cryptoId || req.query.crypto,
    address: req.query.address,
    extraId: req.query.extraId || req.query.extra,
  });
  res.status(200).send(result);
}));

swapApi.post('/api/v1/transaction/:provider', asyncHandler(async (req, res) => {
  const { exchange } = getExchangeOrThrow(req.params.provider);
  const result = await exchange.createTransaction({
    walletId: getWalletId(req),
    from: req.body.from,
    to: req.body.to,
    amount: req.body.amount,
    address: req.body.address,
    extraId: req.body.extraId,
    refundAddress: req.body.refundAddress,
  });
  res.status(200).send(result);
}));

swapApi.get('/api/v1/transactions/:provider', asyncHandler(async (req, res) => {
  const { exchange } = getExchangeOrThrow(req.params.provider);
  const ids = listParam(req.query.transactions);
  const result = await exchange.getTransactions({ ids });
  res.status(200).send(result);
}));

swapApi.use('/logo', express.static(providerLogoPath));
