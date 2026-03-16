import * as chainConnection from './connection.js';

import * as errors from './errors.js';

import * as typed from 'micro-eth-signer/typed-data.js';

import { Transaction } from 'micro-eth-signer';

import { addr as Address } from 'micro-eth-signer';

import { bytesToHex } from '@noble/hashes/utils';

import { ethHex } from 'micro-eth-signer/utils.js';

import {
  Amount,
  CsWallet,
  HistoryCache,
  buildHistoryCursor,
  normalizeHistoryCursor,
} from '@coinspace/cs-common';

import API from './API.js';

import TxTransformer from './TxTransformer.js';

import networks from './networks.js';

import utils from './utils.js';

function getHistoryTxId(tx = {}) {
  return tx.token ? tx.txId : tx._id;
}

export default class EvmWallet extends CsWallet {
  #api;
  #network;

  #address;
  #addressCheckSum;
  #coinBalance = 0n;
  #coinBalanceConfirmed = 0n;
  #tokenBalance = 0n;
  #tokenBalanceConfirmed = 0n;
  #dustThreshold = 1n;
  #txTransformer;
  #transactions = new Map();
  #history;

  #gasLimit;
  #gasLimitSmartContract;
  #minGasLimit = 21000n;

  // memorized functions
  #getGasPrice;
  #getGasFees;
  #getAdditionalFee;
  #prepareImport;
  static getChainLabel(platform) {
    return chainConnection.getChainLabel(platform);
  }
  static getDefaultNode(platform) {
    return chainConnection.getDefaultNode(platform);
  }
  static getNodeOptions(platform) {
    return chainConnection.getNodeOptions(platform);
  }
  static normalizeNodeConfig(platform, config = {}) {
    return chainConnection.normalizeNodeConfig(platform, config);
  }
  static async testNodeConnection(platform, config = {}, fetchFn) {
    return chainConnection.testNodeConnection(platform, config, fetchFn);
  }
  static getDefaultExplorer(platform) {
    return chainConnection.getDefaultExplorer(platform);
  }
  static getExplorerOptions(platform) {
    return chainConnection.getExplorerOptions(platform);
  }
  static normalizeExplorerConfig(platform, config = {}) {
    return chainConnection.normalizeExplorerConfig(platform, config);
  }
  static buildExplorerUrl(platform, type, value, config = {}) {
    return chainConnection.buildExplorerUrl(platform, type, value, config);
  }
  static async getTokenInfo(platform, config, address, fetchFn) {
    return chainConnection.getTokenInfo(platform, config, address, fetchFn);
  }

  get isImportSupported() {
    return true;
  }

  get isGasLimitSupported() {
    return true;
  }

  get isUnaliasSupported() {
    return false;
  }

  get gasLimit() {
    return this.#gasLimit;
  }

  get gasLimitSmartContract() {
    return this.#gasLimitSmartContract;
  }

  get balance() {
    if (this.crypto.type === 'coin') {
      return new Amount(this.#coinBalance, this.crypto.decimals);
    }
    if (this.crypto.type === 'token') {
      return new Amount(this.#tokenBalance, this.crypto.decimals);
    }
    throw new errors.InternalWalletError('Unsupported crypto type');
  }

  get tokenUrl() {
    if (this.crypto.type === 'token') {
      return this.#network.tokenUrl.replace('${tokenAddress}', this.crypto.address);
    }
    return undefined;
  }

  static tokenUrl(platform, address, development) {
    const network = networks[development ? 'testnet' : 'mainnet'][platform];
    return network.tokenUrl.replace('${tokenAddress}', address);
  }

  get address() {
    return this.#addressCheckSum;
  }

  get defaultSettings() {
    const network = networks[this.development ? 'testnet' : 'mainnet'][this.crypto.platform];
    return {
      bip44: network.bip44,
    };
  }

  get isSettingsSupported() {
    return this.crypto.type === 'coin';
  }

  get dummyExchangeDepositAddress() {
    return '0x7fe33da42015b2876e16a3d5b3cd34a0b7c80874';
  }

  get isWalletConnectSupported() {
    return this.crypto.type === 'coin';
  }

  get chainId() {
    return `eip155:${this.#network.chainId}`;
  }

  get accountId() {
    return `${this.chainId}:${this.address}`;
  }

  constructor(options = {}) {
    super(options);

    this.#api = new API(this);
    this.#network = networks[options.development ? 'testnet' : 'mainnet'][options.crypto.platform];

    this.#gasLimit = this.crypto.type === 'token'
      ? this.#network.gasLimitToken || 200000n
      : this.#network.gasLimitCoin || 21000n;

    this.#gasLimitSmartContract = this.#network.gasLimitSmartContract || 500_000n;
    this.#getGasPrice = this.memoize(this._getGasPrice);
    this.#getGasFees = this.memoize(this._getGasFees);
    this.#getAdditionalFee = this.memoize(this._getAdditionalFee);
    this.#prepareImport = this.memoize(this._prepareImport);
    this.#history = new HistoryCache({
      storage: this.storage,
      getId: getHistoryTxId,
    });

    this.#txTransformer = new TxTransformer({
      wallet: this,
      network: this.#network,
    });
  }

  async create(seed) {
    this.typeSeed(seed);
    this.state = CsWallet.STATE_INITIALIZING;
    const privateKey = utils.privateKeyFromMasterSeed(seed, this.settings.bip44, this.crypto.platform);
    this.#addressCheckSum = Address.fromPrivateKey(privateKey);
    this.#address = this.#addressCheckSum.toLowerCase();

    this.#init();
    this.state = CsWallet.STATE_INITIALIZED;
  }

  async open(publicKey) {
    this.typePublicKey(publicKey);
    this.state = CsWallet.STATE_INITIALIZING;

    if (publicKey.settings.bip44 === this.settings.bip44) {
      this.#addressCheckSum = publicKey.data;
      this.#address = this.#addressCheckSum.toLowerCase();
      this.#init();
      this.state = CsWallet.STATE_INITIALIZED;
    } else {
      this.state = CsWallet.STATE_NEED_INITIALIZATION;
    }
  }

  #init() {
    if (this.crypto.type === 'coin') {
      this.#coinBalance = BigInt(this.storage.get('balance') || 0);
    }
    if (this.crypto.type === 'token') {
      this.#tokenBalance = BigInt(this.storage.get('balance') || 0);
    }
  }

  #getHistoryOwner() {
    return this.#address;
  }

  async #ensureHistoryCacheLoaded() {
    await this.#history.load(this.#getHistoryOwner());
  }

  async #saveHistoryCache() {
    await this.#history.save(this.#getHistoryOwner());
  }

  async #fetchTransactions(cursor) {
    return this.crypto.type === 'coin'
      ? await this.#api.loadTransactions(this.#address, cursor)
      : await this.#api.loadTokenTransactions(this.crypto.address, this.#address, cursor);
  }

  #rememberHistoryTransactions(txs = []) {
    const transactions = this.#txTransformer.transformTxs(txs);
    for (const transaction of transactions) {
      this.#transactions.set(transaction.id, transaction);
    }
    return transactions;
  }

  #buildHistoryResult(offset = 0) {
    const { items, hasMore, cursor } = this.#history.page(offset, this.txPerPage);
    const raw = items;
    const transactions = this.#rememberHistoryTransactions(raw);
    return {
      transactions,
      hasMore,
      cursor,
    };
  }

  async #syncHistoryCache() {
    await this.#ensureHistoryCacheLoaded();
    const fetched = [];
    let nextCursor;

    if (!this.#history.items.length) {
      const res = await this.#fetchTransactions();
      this.#history.replace(res.txs, res.cursor);
      await this.#saveHistoryCache();
      return;
    }

    const cachedIds = new Set(this.#history.items.map((tx) => getHistoryTxId(tx)));
    const boundaryTimestamp = this.#history.items.at(-1)?.timestamp || 0;
    let cursor;
    let hasMore = true;

    while (hasMore) {
      const res = await this.#fetchTransactions(cursor);
      const page = res.txs || [];
      nextCursor = res.cursor;
      if (!page.length) {
        nextCursor = undefined;
        break;
      }
      fetched.push(...page);
      const reachedBoundary = page.some((tx) => {
        return cachedIds.has(getHistoryTxId(tx)) || tx.timestamp <= boundaryTimestamp;
      });
      hasMore = !reachedBoundary && res.hasMore && res.cursor !== undefined;
      ({ cursor } = res);
    }

    if (!fetched.length) return;
    this.#history.merge(fetched, nextCursor);
    await this.#saveHistoryCache();
  }

  async load() {
    this.state = CsWallet.STATE_LOADING;
    try {
      const { balance, confirmedBalance } = await this.#getCoinBalance();
      this.#coinBalance = balance;
      this.#coinBalanceConfirmed = confirmedBalance;

      if (this.crypto.type === 'coin') {
        this.storage.set('balance', this.#coinBalance.toString());
      }
      if (this.crypto.type === 'token') {
        const { balance, confirmedBalance } = await this.#getTokenBalance();
        this.#tokenBalance = balance;
        this.#tokenBalanceConfirmed = confirmedBalance;
        this.storage.set('balance', this.#tokenBalance.toString());
      }
      await this.storage.save();
      this.state = CsWallet.STATE_LOADED;
    } catch (err) {
      this.state = CsWallet.STATE_ERROR;
      throw err;
    }
  }

  async cleanup() {
    await super.cleanup();
    this.memoizeClear(this.#getGasPrice);
    this.memoizeClear(this.#getGasFees);
    this.memoizeClear(this.#getAdditionalFee);
    this.memoizeClear(this.#prepareImport);
  }

  async inspectAddressActivity() {
    if (this.crypto.type === 'token') {
      return super.inspectAddressActivity();
    }
    return {
      address: this.#addressCheckSum,
      active: await this.#api.hasIndexedActivity(this.#address),
    };
  }

  getPublicKey() {
    return {
      settings: this.settings,
      data: this.#addressCheckSum,
    };
  }

  getPrivateKey(seed) {
    this.typeSeed(seed);
    const privateKey = utils.privateKeyFromMasterSeed(seed, this.settings.bip44, this.crypto.platform);
    return [{
      address: this.#addressCheckSum,
      privatekey: bytesToHex(privateKey),
    }];
  }

  async #getCoinBalance() {
    return this.#api.coinBalance(this.#address, this.#network.minConf);
  }

  async #getTokenBalance() {
    return this.#api.tokenBalance(this.crypto.address, this.#address, this.#network.minConf);
  }

  async #getMinerFee(gasLimit) {
    if (this.#network.eip1559) {
      const { maxFeePerGas } = await this.#getGasFees();
      return gasLimit * maxFeePerGas;
    } else {
      const gasPrice = await this.#getGasPrice();
      return gasLimit * gasPrice;
    }
  }

  async _getGasPrice() {
    return this.#api.gasPrice();
  }

  async _getGasFees() {
    return this.#api.gasFees();
  }

  async _getAdditionalFee() {
    return this.#api.getAdditionalFee(this.crypto.type === 'token');
  }

  async validateAddress({ address }) {
    super.validateAddress({ address });
    address = address.toLowerCase();
    utils.validateAddress(address);
    if (address === this.#address) {
      throw new errors.DestinationEqualsSourceError();
    }
    return true;
  }

  async validateGasLimit({ gasLimit }) {
    super.validateGasLimit({ gasLimit });
    if (gasLimit < this.#minGasLimit) {
      throw new errors.SmallGasLimitError(this.#minGasLimit);
    }
    if (gasLimit > this.#network.maxGasLimit) {
      throw new errors.BigGasLimitError(this.#network.maxGasLimit);
    }
    return true;
  }

  async validateAmount({ gasLimit, address, amount }) {
    super.validateAmount({ gasLimit, address, amount });
    const { value } = amount;

    if (value < this.#dustThreshold) {
      throw new errors.SmallAmountError(new Amount(this.#dustThreshold, this.crypto.decimals));
    }
    if (this.crypto.type === 'token') {
      const fee = await this.#getMinerFee(gasLimit);
      if (fee > this.#coinBalance) {
        throw new errors.InsufficientCoinForTransactionFeeError(new Amount(fee, this.platform.decimals));
      }
    }
    const maxAmount = await this.#estimateMaxAmount({ gasLimit });
    if (value > maxAmount) {
      const unconfirmedMaxAmount = await this.#estimateMaxAmount({ gasLimit, unconfirmed: true });
      if (value < unconfirmedMaxAmount) {
        throw new errors.BigAmountConfirmationPendingError(new Amount(maxAmount, this.crypto.decimals));
      } else {
        throw new errors.BigAmountError(new Amount(maxAmount, this.crypto.decimals));
      }
    }
    return true;
  }

  async estimateTransactionFee({ gasLimit, address, amount }) {
    super.estimateTransactionFee({ gasLimit, address, amount });
    const fee = await this.#getMinerFee(gasLimit);
    return new Amount(fee, this.crypto.type === 'coin' ? this.crypto.decimals : this.platform.decimals);
  }

  async #estimateMaxAmount({ gasLimit, unconfirmed = false }) {
    if (this.crypto.type === 'coin') {
      const balance = unconfirmed ? this.#coinBalance : utils.minBigInt(this.#coinBalance, this.#coinBalanceConfirmed);
      if (!balance) return 0n;
      const minerFee = await this.#getMinerFee(gasLimit);
      if (balance < minerFee) {
        return 0n;
      }
      return balance - minerFee;
    }
    if (this.crypto.type === 'token') {
      if (unconfirmed) return this.#tokenBalance;
      return utils.minBigInt(this.#tokenBalance, this.#tokenBalanceConfirmed);
    }
  }

  async estimateMaxAmount({ gasLimit, address }) {
    super.estimateMaxAmount({ gasLimit, address });
    const maxAmount = await this.#estimateMaxAmount({ gasLimit });
    return new Amount(maxAmount, this.crypto.decimals);
  }

  async #getGasParams() {
    if (this.#network.eip1559) {
      return this.#getGasFees();
    } else {
      const gasPrice = await this.#getGasPrice();
      return { gasPrice };
    }
  }

  async createTransaction({ gasLimit, address, amount }, seed, extraEntropy) {
    super.createTransaction({ gasLimit, address, amount }, seed);
    const { value } = amount;
    address = address.toLowerCase();

    const nonce = await this.#api.txsCount(this.#address);
    const transaction = this.crypto.type === 'coin'
      ? Transaction.prepare({
        type: this.#network.eip1559 ? 'eip1559' : 'legacy',
        to: address,
        value,
        nonce,
        gasLimit,
        ...(await this.#getGasParams()),
        chainId: BigInt(this.#network.chainId),
      }, false)
      : Transaction.prepare({
        type: this.#network.eip1559 ? 'eip1559' : 'legacy',
        to: this.crypto.address,
        value: 0n,
        data: utils.tokenTransferData(address, value),
        nonce,
        gasLimit,
        ...(await this.#getGasParams()),
        chainId: BigInt(this.#network.chainId),
      }, false);

    const privateKey = utils.privateKeyFromMasterSeed(seed, this.settings.bip44, this.crypto.platform);
    const signedTx = transaction.signBy(privateKey, extraEntropy);

    const id = await this.#api.sendTransaction(signedTx.toHex());
    if (this.crypto.type === 'coin') {
      this.#coinBalance -= value + signedTx.fee;
      this.storage.set('balance', this.#coinBalance.toString());
    }
    if (this.crypto.type === 'token') {
      this.#coinBalance -= signedTx.fee;
      this.#tokenBalance -= value;
      this.storage.set('balance', this.#tokenBalance.toString());
    }
    await this.storage.save();
    return id;
  }

  async eth_sendTransaction(data, seed) {
    const nonce = await this.#api.txsCount(this.#address);
    const value = data.value ? BigInt(data.value) : 0n;
    const transaction = Transaction.prepare({
      type: this.#network.eip1559 ? 'eip1559' : 'legacy',
      from: data.from,
      to: data.to,
      value,
      data: data.data,
      nonce,
      gasLimit: data.gas ? BigInt(data.gas) : this.gasLimitSmartContract,
      ...(await this.#getGasParams()),
      chainId: BigInt(this.#network.chainId),
    }, false);

    const privateKey = utils.privateKeyFromMasterSeed(seed, this.settings.bip44, this.crypto.platform);
    const signedTx = transaction.signBy(privateKey);

    const id = await this.#api.sendTransaction(signedTx.toHex());
    if (this.crypto.type === 'coin') {
      this.#coinBalance -= value + signedTx.fee;
      this.storage.set('balance', this.#coinBalance.toString());
    }
    if (this.crypto.type === 'token') {
      this.#coinBalance -= signedTx.fee;
      this.#tokenBalance -= value;
      this.storage.set('balance', this.#tokenBalance.toString());
    }
    await this.storage.save();
    return id;
  }

  async estimateImport({ privateKey }) {
    super.estimateImport();
    const { sendable } = await this.#prepareImport({ privateKey });
    return new Amount(sendable, this.crypto.decimals);
  }

  async createImport({ privateKey }, extraEntropy) {
    super.createImport();
    const { sendable, from } = await this.#prepareImport({ privateKey });

    const nonce = await this.#api.txsCount(from);
    const transaction = this.crypto.type === 'coin'
      ? Transaction.prepare({
        type: this.#network.eip1559 ? 'eip1559' : 'legacy',
        to: this.#address,
        value: sendable,
        nonce,
        gasLimit: this.#gasLimit,
        ...(await this.#getGasParams()),
        chainId: BigInt(this.#network.chainId),
      })
      : Transaction.prepare({
        type: this.#network.eip1559 ? 'eip1559' : 'legacy',
        to: this.crypto.address,
        value: 0n,
        data: utils.tokenTransferData(this.#address, sendable),
        nonce,
        gasLimit: this.#gasLimit,
        ...(await this.#getGasParams()),
        chainId: BigInt(this.#network.chainId),
      });

    const signedTx = transaction.signBy(privateKey, extraEntropy);
    const id = await this.#api.sendTransaction(signedTx.toHex());
    if (this.crypto.type === 'coin') {
      this.#coinBalance += sendable;
      this.storage.set('balance', this.#coinBalance.toString());
    }
    if (this.crypto.type === 'token') {
      this.#tokenBalance += sendable;
      this.storage.set('balance', this.#tokenBalance.toString());
    }
    await this.storage.save();
    return id;
  }

  async estimateReplacement(tx) {
    super.estimateReplacement(tx);
    const rbfGasPrice = utils.multiplyGasPrice((tx.gasPrice || tx.maxFeePerGas), this.#network.rbfFactor);
    const fee = rbfGasPrice * tx.gasLimit - tx.fee.value;
    const balance = utils.minBigInt(this.#coinBalance, this.#coinBalanceConfirmed);
    if ((balance - fee) < 0n) {
      throw new errors.BigAmountError();
    }
    return {
      percent: Number((this.#network.rbfFactor - 1).toFixed(2)),
      fee: new Amount(fee, this.crypto.type === 'coin' ? this.crypto.decimals : this.platform.decimals),
    };
  }

  async createReplacementTransaction(tx, seed) {
    super.createReplacementTransaction(tx, seed);
    const eip1559 = !!tx.maxFeePerGas;
    const transaction = Transaction.prepare({
      type: eip1559 ? 'eip1559' : 'legacy',
      to: tx.to,
      value: tx.amount.value,
      nonce: BigInt(tx.nonce),
      data: tx.input,
      gasLimit: tx.gasLimit,
      ...eip1559 ? {
        maxFeePerGas: utils.multiplyGasPrice(tx.maxFeePerGas, this.#network.rbfFactor),
        maxPriorityFeePerGas: utils.multiplyGasPrice(tx.maxPriorityFeePerGas, this.#network.rbfFactor),
      } : {
        gasPrice: utils.multiplyGasPrice(tx.gasPrice, this.#network.rbfFactor),
      },
      chainId: BigInt(this.#network.chainId),
    }, false);

    const privateKey = utils.privateKeyFromMasterSeed(seed, this.settings.bip44, this.crypto.platform);
    const signedTx = transaction.signBy(privateKey);
    const fee = signedTx.fee - tx.fee.value;

    const id = await this.#api.sendTransaction(signedTx.toHex());

    this.#coinBalance -= fee;
    this.storage.set('balance', this.#coinBalance.toString());
    await this.storage.save();
    return id;
  }

  async loadTransactions({ cursor } = {}) {
    await this.#ensureHistoryCacheLoaded();
    if (!cursor) {
      this.#transactions.clear();
      await this.#syncHistoryCache();
      return this.#buildHistoryResult(0);
    }

    const { cacheOffset, remoteCursor } = normalizeHistoryCursor(cursor);
    if (cacheOffset < this.#history.items.length) {
      return this.#buildHistoryResult(cacheOffset);
    }

    const res = await this.#fetchTransactions(remoteCursor);
    if (res.txs.length) {
      this.#history.append(res.txs, res.cursor);
      await this.#saveHistoryCache();
    }
    const transactions = this.#rememberHistoryTransactions(res.txs);
    return {
      transactions,
      hasMore: res.hasMore,
      cursor: res.hasMore ? buildHistoryCursor(this.#history.items.length, res.cursor) : undefined,
    };
  }

  async loadTransaction(id) {
    await this.#ensureHistoryCacheLoaded();
    if (this.#transactions.has(id)) {
      return this.#transactions.get(id);
    }
    const cached = this.#history.find(id);
    if (cached) {
      const [transaction] = this.#rememberHistoryTransactions([cached]);
      return transaction;
    }
    try {
      return this.#txTransformer.transformTx(await this.#api.loadTransaction(id));
    } catch {
      return;
    }
  }

  async _prepareImport({ privateKey }) {
    let address;
    try {
      address = Address.fromPrivateKey(privateKey).toLowerCase();
    } catch (err) {
      throw new errors.InvalidPrivateKeyError(undefined, { cause: err });
    }
    if (address === this.#address) {
      throw new errors.DestinationEqualsSourceError();
    }
    const [{ balance, confirmedBalance }, fee] = await Promise.all([
      this.crypto.type === 'coin'
        ? this.#api.coinBalance(address, this.#network.minConf)
        : this.#api.tokenBalance(this.crypto.address, address, this.#network.minConf),
      this.#getMinerFee(this.#gasLimit),
    ]);
    const value = utils.minBigInt(balance, confirmedBalance);
    const sendable = this.crypto.type === 'coin' ? value - fee : value;

    if (sendable < this.#dustThreshold) {
      const minimum = this.#dustThreshold + (this.crypto.type === 'coin' ? fee : 0n);
      throw new errors.SmallAmountError(new Amount(minimum, this.crypto.decimals));
    }

    let coinBalance;
    if (this.crypto.type === 'token') {
      const { balance, confirmedBalance } = await this.#api.coinBalance(address, this.#network.minConf);
      coinBalance = utils.minBigInt(balance, confirmedBalance);
      if (fee > coinBalance) {
        throw new errors.InsufficientCoinForTransactionFeeError(new Amount(fee, this.platform.decimals));
      }
    }
    return {
      value,
      fee,
      sendable,
      from: address,
    };
  }

  async eth_signTypedData(data, seed, extraEntropy) {
    if (typeof data === 'string') {
      data = JSON.parse(data);
    }
    const privateKey = utils.privateKeyFromMasterSeed(seed, this.settings.bip44, this.crypto.platform);
    const sanitized = utils.sanitizeTypedData(data);
    return typed.signTyped(sanitized, privateKey, extraEntropy);
  }

  async eth_sign(msg, seed, extraEntropy) {
    if (typeof msg === 'string') {
      if (msg.startsWith('0x')) {
        msg = ethHex.decode(msg);
      }
    }
    const privateKey = utils.privateKeyFromMasterSeed(seed, this.settings.bip44, this.crypto.platform);
    return typed.personal.sign(msg, privateKey, extraEntropy);
  }
}
