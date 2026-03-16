/* eslint-disable no-unused-vars */
import Amount from './Amount.js';
import { EmptyAddressError, InternalWalletError } from './errors.js';
import { calculateCsFee, calculateCsFeeForMaxAmount } from './fee.js';
import pMemoize, { pMemoizeClear } from 'p-memoize';

export default class CsWallet {
  #crypto;
  #platform;
  #settings;
  #request;
  #apiNode;
  #connection;
  #txPerPage;
  #cache;
  #storage;
  #development;

  #addressType;
  #state;

  static STATE_CREATED = Symbol('CREATED');
  static STATE_NEED_INITIALIZATION = Symbol('NEED_INITIALIZATION');
  static STATE_INITIALIZING = Symbol('INITIALIZING');
  static STATE_INITIALIZED = Symbol('INITIALIZED');
  static STATE_LOADING = Symbol('LOADING');
  static STATE_LOADED = Symbol('LOADED');
  static STATE_ERROR = Symbol('ERROR');

  static ADDRESS_TYPE_BASE = Symbol('base');
  static ADDRESS_TYPE_UNKNOWN = Symbol('unknown');

  static FEE_RATE_DEFAULT = Symbol('default');

  get crypto() {
    return this.#crypto;
  }

  get platform() {
    return this.#platform;
  }

  get settings() {
    return this.#settings;
  }

  set settings(settings) {
    this.#settings = settings;
  }

  get defaultSettings() {
    return {};
  }

  set apiNode(apiNode) {
    this.#apiNode = apiNode;
  }

  get apiNode() {
    return this.#apiNode;
  }

  set connection(connection) {
    this.#connection = connection;
  }

  get connection() {
    return this.#connection;
  }

  get txPerPage() {
    return this.#txPerPage;
  }

  get cache() {
    return this.#cache;
  }

  get storage() {
    return this.#storage;
  }

  get development() {
    return this.#development;
  }

  get isAddressTypesSupported() {
    return this.addressTypes.length > 1;
  }

  get isAddressChangeSupported() {
    return false;
  }

  get isFeeRatesSupported() {
    return this.feeRates.length > 1;
  }

  get isGasLimitSupported() {
    return false;
  }

  get isMetaSupported() {
    return false;
  }

  get isFactorsSupported() {
    return false;
  }

  /**
   * Export is supported by default
   */
  get isExportSupported() {
    return true;
  }

  get isImportSupported() {
    return false;
  }

  get isSettingsSupported() {
    return false;
  }

  get isCsFeeSupported() {
    return false;
  }

  get isUnaliasSupported() {
    return false;
  }

  get isStakingSupported() {
    return false;
  }

  get isWalletConnectSupported() {
    return false;
  }

  static tokenUrl(/*platform, address, development*/) {
    throw new InternalWalletError('not impemented');
  }

  static tokenApiUrl(address) {
    return `api/v1/token/${address}`;
  }

  static getChainLabel(platform) {
    return platform;
  }

  static getDefaultNode() {
    return {
      preset: 'custom',
      baseURL: '',
      apiType: undefined,
    };
  }

  static getNodeOptions() {
    return [{
      value: 'custom',
      name: 'Custom',
    }];
  }

  static normalizeNodeConfig(platform, config = {}) {
    void platform;
    return {
      ...this.getDefaultNode(platform),
      ...config,
    };
  }

  static async testNodeConnection() {
    throw new InternalWalletError('node testing is not implemented');
  }

  static getDefaultExplorer() {
    return {
      preset: 'custom',
      baseURL: '',
    };
  }

  static getExplorerOptions() {
    return [{
      value: 'custom',
      name: 'Custom',
    }];
  }

  static normalizeExplorerConfig(platform, config = {}) {
    void platform;
    return {
      ...this.getDefaultExplorer(platform),
      ...config,
    };
  }

  static buildExplorerUrl(platform, type, value, config = {}) {
    void platform;
    void type;
    void value;
    void config;
    return '';
  }

  static async getTokenInfo() {
    throw new InternalWalletError('custom token lookup is not implemented');
  }

  /**
   * Wallet Status:
   * 1) created - only the created wallet, we can only get the balance from the cache
   * 2) need initialization - the wallet was not initially initialized
   * 3) initializing - initialization process
   * 3) initialized - initialized wallet, but the current balance, transactions, etc. are not loaded
   * 4) loading - loading the balance and other data from the node
   * 5) loaded - fully loaded wallet
   * 6) error
   */
  get states() {
    return [
      CsWallet.STATE_CREATED,
      CsWallet.STATE_NEED_INITIALIZATION,
      CsWallet.STATE_INITIALIZING,
      CsWallet.STATE_INITIALIZED,
      CsWallet.STATE_LOADING,
      CsWallet.STATE_LOADED,
      CsWallet.STATE_ERROR,
    ];
  }

  get state() {
    return this.#state;
  }

  set state(state) {
    if (this.states.includes(state)) {
      this.#state = state;
    } else {
      throw new TypeError(`unsupported state: ${state}`);
    }
  }

  /**
   *
   * The constructor synchronously creates a wallet with basic functions.
   * Data is read synchronously from Cache only.
   * Available for use: balance, crypto parameters.
   *
   * We can already show such a wallet in the list of cryptos,
   * displaying past balance or 0.
   *
   * @param {*} options
   * crypto
   * platform
   * cryptoSettings
   * platformSettings
   *
   * publicKey
   */
  constructor({
    crypto,
    platform,
    settings,
    request,
    apiNode,
    connection,
    txPerPage = 10,
    cache,
    storage,
    development = false,
  }) {
    if (!crypto) {
      throw new TypeError('crypto must be set');
    }
    if (!platform) {
      throw new TypeError('platform must be set');
    }
    if (!settings) {
      throw new TypeError('settings must be set');
    }
    if (!request) {
      throw new TypeError('request must be set');
    }
    if (!apiNode) {
      throw new TypeError('apiNode must be set');
    }
    if (!cache) {
      throw new TypeError('cache must be set');
    }
    if (!storage) {
      throw new TypeError('storage must be passed');
    }
    this.#development = !!development;
    this.#crypto = crypto;
    this.#platform = platform;
    // it is platform settings
    // but keep it is settings for short
    this.#settings = {
      ...this.defaultSettings,
      ...settings,
    };
    this.#request = request;
    this.#apiNode = apiNode;
    this.#connection = connection;
    this.#txPerPage = txPerPage;
    this.#cache = cache;
    this.#storage = storage;
    this.state = CsWallet.STATE_CREATED;

    this.getCsFeeConfig = this.memoize(this._getCsFeeConfig);
  }

  /**
   * Wallet address
   */
  get address() {
    return '';
  }

  get balance() {
    return new Amount(0, 0);
  }

  async inspectAddressActivity() {
    const { transactions } = await this.loadTransactions();
    return {
      address: this.address,
      active: transactions.length > 0,
    };
  }

  get addressTypes() {
    return [
      CsWallet.ADDRESS_TYPE_BASE,
    ];
  }

  get addressType() {
    if (!this.#addressType) {
      if (this.#cache.get('addressType') !== undefined) {
        const addressType = this.#cache.get('addressType');
        this.#addressType = this.addressTypes.find((item) => item.description === addressType) || this.addressTypes[0];
      } else {
        this.#addressType = this.addressTypes[0];
      }
    }
    return this.#addressType;
  }

  set addressType(addressType) {
    if (!this.addressTypes.includes(addressType)) {
      throw new TypeError('unsupported address type');
    }
    this.#addressType = addressType;
    this.#cache.set('addressType', addressType.description);
  }

  get feeRates() {
    return [
      CsWallet.FEE_RATE_DEFAULT,
    ];
  }

  get gasLimit() {
    return 0n;
  }

  get dummyExchangeDepositAddress() {
    return '';
  }

  requestWeb(config) {
    return this.#request({
      method: 'GET',
      seed: 'device',
      ...config,
    });
  }

  requestNode(config) {
    return this.#request({
      public: true,
      id: false,
      ...config,
      baseURL: this.#apiNode,
    });
  }

  requestPublic(config) {
    return this.#request({
      public: true,
      id: false,
      ...config,
    });
  }

  /**
   * Create a wallet by seed on the device
   */
  async create() { }
  /**
   * Open wallet by pin code (seed device)
   */
  async open() { }

  /**
   * Wallet loaded asynchronously: balance
   * After loading the wallet can be fully used.
   */
  async load() { }

  /**
   * Only if isFeeRatesSupported
   */
  async loadFeeRates() { }

  /**
   * Clean stuff before send screen
   */
  async cleanup() {
    this.memoizeClear(this.getCsFeeConfig);
  }

  getPublicKey(/*options*/) {
    return {};
  }

  getPrivateKey(seed/*, options*/) {
    this.typeSeed(seed);
    return [{}];
  }

  async _getCsFeeConfig() {
    if (!this.isCsFeeSupported) {
      return {
        disabled: true,
      };
    }
    try {
      const config = await this.requestWeb({
        method: 'GET',
        url: 'api/v4/csfee',
        params: {
          crypto: this.crypto._id,
        },
      });
      if (config && config.fee) {
        return {
          disabled: false,
          address: config.address,
          fee: parseFloat(config.fee),
          minFee: parseFloat(config.minFee),
          maxFee: parseFloat(config.maxFee),
          feeAddition: BigInt(config.feeAddition || 0),
        };
      } else {
        return {
          disabled: true,
        };
      }
    } catch (err) {
      console.error('getCsFeeConfig error:', err);
      return {
        disabled: true,
      };
    }
  }

  async calculateCsFee(value, config) {
    const csFeeConfig = await this.getCsFeeConfig();
    return calculateCsFee(value, {
      ...csFeeConfig,
      decimals: this.crypto.decimals,
      // config.dustThreshold
      // config.price
      ...config,
    });
  }

  async calculateCsFeeForMaxAmount(value, config) {
    const csFeeConfig = await this.getCsFeeConfig();
    return calculateCsFeeForMaxAmount(value, {
      ...csFeeConfig,
      decimals: this.crypto.decimals,
      // config.dustThreshold
      // config.price
      ...config,
    });
  }

  /**
   * Type validators
   */

  typeFeeRate(feeRate) {
    if (this.isFeeRatesSupported) {
      if (typeof feeRate !== 'symbol') {
        throw new TypeError(`fee rate must be a symbol, ${typeof feeRate} provided`);
      }
      if (!this.feeRates.includes(feeRate)) {
        throw new TypeError(`unsupported fee rate: ${feeRate.description}`);
      }
    }
  }

  typeGasLimit(gasLimit) {
    if (this.isGasLimitSupported) {
      if (typeof gasLimit !== 'bigint') {
        throw new TypeError(`gasLimit must be a bigint, ${typeof gasLimit} provided`);
      }
    }
  }

  typeAddress(address) {
    if (typeof address !== 'string') {
      throw new TypeError(`address must be a string, ${typeof address} provided`);
    }
  }

  typeMeta(meta) {
    if (this.isMetaSupported) {
      if (meta !== undefined && typeof meta !== 'object') {
        throw new TypeError(`meta must be an object, ${typeof meta} provided`);
      }
    }
  }

  typeAmount(amount) {
    if (!(amount instanceof Amount)) {
      throw new TypeError(`amount must be an instance of Amount, ${typeof amount} provided`);
    }
    if (amount.decimals !== this.crypto.decimals) {
      throw new TypeError(`amount has wrong decimals ${amount.decimals}, expected ${this.crypto.decimals}`);
    }
  }

  typePrice(price) {
    if (this.isCsFeeSupported) {
      if (typeof price !== 'number' || Number.isNaN(price)) {
        throw new TypeError(`price must be a number, ${typeof price} provided (${price})`);
      }
    }
  }

  typeSeed(seed) {
    if (!(seed instanceof Uint8Array)) {
      throw new TypeError(`seed must be an instance of Uint8Array or Buffer, ${typeof seed} provided`);
    }
    if (seed.length !== 64) {
      throw new TypeError(`incorrect seed length: ${seed.length}`);
    }
  }

  typePublicKey(publicKey) {
    if (!publicKey?.data) {
      throw new TypeError('publicKey must be an instance of Object with data property');
    }
  }

  validateDerivationPath(path) {
    return /^m(\/\d+'?)*$/.test(path);
  }

  validateAddress({ address }) {
    this.typeAddress(address);
    if (!address.trim()) {
      throw new EmptyAddressError();
    }
  }

  /**
   * Transaction optional parameters validation
   */
  validateMeta({ address, meta }) {
    this.typeAddress(address);
    this.typeMeta(meta);
  }

  validateGasLimit({ gasLimit }) {
    this.typeGasLimit(gasLimit);
  }

  validateAmount({ feeRate, gasLimit, address, meta, amount, price } = {}) {
    this.typeFeeRate(feeRate);
    this.typeGasLimit(gasLimit);
    this.typeAddress(address);
    this.typeMeta(meta);
    this.typeAmount(amount);
    this.typePrice(price);
  }

  estimateTransactionFee({ feeRate, gasLimit, address, meta, amount, price } = {}) {
    this.typeFeeRate(feeRate);
    this.typeGasLimit(gasLimit);
    this.typeAddress(address);
    this.typeMeta(meta);
    this.typeAmount(amount);
    this.typePrice(price);
  }

  /**
   * For some cryptocurrencies, the maximum will be recalculated when the recipient's address changes,
   * for others will be fixed.
   *
   * @param {*} options
   */
  estimateMaxAmount({ feeRate, gasLimit, address, meta, price } = {}) {
    this.typeFeeRate(feeRate);
    this.typeGasLimit(gasLimit);
    this.typeAddress(address);
    this.typeMeta(meta);
    this.typePrice(price);
  }

  createTransaction({ feeRate, gasLimit, address, meta, amount, price }, seed) {
    this.typeFeeRate(feeRate);
    this.typeGasLimit(gasLimit);
    this.typeAddress(address);
    this.typeMeta(meta);
    this.typeAmount(amount);
    this.typeSeed(seed);
    this.typePrice(price);
  }

  estimateReplacement(tx) {
  }

  createReplacementTransaction(tx, seed) {
  }

  estimateImport({ privateKey, feeRate, price } = {}) {
    this.typeFeeRate(feeRate);
    this.typePrice(price);
  }

  createImport({ privateKey, feeRate, price } = {}) {
    this.typeFeeRate(feeRate);
    this.typePrice(price);
  }

  loadTransactions() {
  }

  loadTransaction() {
  }

  async unalias(alias) {
    if (!this.isUnaliasSupported) return;
    if (typeof alias !== 'string') return;
    const domain = alias.replaceAll('@', '.');
    if (!/\./.test(domain)) return;
    try {
      const { address } = await this.requestWeb({
        url: 'api/v4/domain/address',
        params: {
          crypto: this.crypto._id,
          domain,
        },
      });
      return {
        alias,
        address,
      };
      // eslint-disable-next-line no-empty
    } catch (err) {}
  }

  /**
   * Helpers
   */

  memoize(fn, options) {
    // check cache key for different use cases
    return pMemoize(fn, {
      cacheKey(args) {
        return JSON.stringify(args, (key, value) => {
          if (typeof value === 'bigint') return value.toString();
          if (typeof value === 'symbol') return value.description;
          return value;
        });
      },
      ...options,
    });
  }

  memoizeClear(fn) {
    return pMemoizeClear(fn);
  }
}
