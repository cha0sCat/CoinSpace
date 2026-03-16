import { CsWallet } from '@coinspace/cs-common';

import { EventEmitter } from 'events';

import { ed25519 } from '@noble/curves/ed25519';

import { hex } from '@scure/base';
import { hmac } from '@noble/hashes/hmac';
import { randomBytes } from '@noble/hashes/utils';
import { sha256 } from '@noble/hashes/sha256';

import {
  buildExplorerUrl,
  getTokenInfo,
  testNodeConnection,
} from '../connections.js';
import {
  getBaseURL,
  loadWalletModule,
} from '../constants.js';

import Biometry from './Biometry.js';
import PasswordUnlock from './PasswordUnlock.js';
import WebAuthnUnlock from './WebAuthnUnlock.js';
import {
  createPinUnlockConfig,
  unlockDeviceSeedWithPin,
} from './PinUnlock.js';

import Cache from './Cache.js';

import ClientStorage from '../storage/ClientStorage.js';

import CryptoDB from './CryptoDB.js';

import Details from '../storage/Details.js';

import Exchanges from '../exchanges/Exchanges.js';

import Market from './Market.js';

import Request from './Request.js';

import Seeds from './Seeds.js';

import Settings from './Settings.js';

import WalletStorage from '../storage/WalletStorage.js';

import i18n from '../i18n/i18n.js';

export class CryptoAlreadyAddedError extends TypeError {
  name = 'CryptoAlreadyAddedError';
  constructor(id, options) {
    super(`Crypto '${id}' already added'`, options);
  }
}

export class SeedRequiredError extends Error {
  name = 'SeedRequiredError';
}

class WalletManager {
  #wallets;
  constructor() {
    this.#wallets = new Map();
  }

  set(wallet) {
    this.#wallets.set(wallet.crypto._id, wallet);
  }

  setMany(wallets = []) {
    wallets.forEach((wallet) => this.set(wallet));
  }

  get(id) {
    return this.#wallets.get(id);
  }

  has(id) {
    return this.#wallets.has(id);
  }

  delete(id) {
    this.#wallets.delete(id);
  }

  getByChainId(chainId) {
    return [...this.#wallets.values()].find((wallet) => {
      return wallet.isWalletConnectSupported && wallet.chainId === chainId;
    });
  }

  filterByPlatform(platform) {
    return [...this.#wallets.values()].filter((wallet) => {
      return wallet.crypto.platform === platform;
    });
  }

  filterByType(type) {
    return [...this.#wallets.values()].filter((wallet) => {
      return wallet.crypto.type === type;
    });
  }

  tokensByPlatform(platform) {
    return [...this.#wallets.values()].filter((wallet) => {
      return wallet.crypto.platform === platform && wallet.crypto.type === 'token';
    });
  }

  list() {
    return [...this.#wallets.values()];
  }
}

class MemoryCache {
  #cache = {};

  get(key) {
    return this.#cache[key];
  }

  set(key, value) {
    this.#cache[key] = value;
  }
}

class MemoryStorage {
  #storage = {};
  #status = 'created';

  async init(data) {
    this.#storage = data ? { ...data } : {};
    this.#status = 'ready';
  }

  async save() {
    if (this.#status !== 'ready') {
      throw new Error('MemoryStorage not ready');
    }
  }

  get(key) {
    if (this.#status !== 'ready') {
      throw new Error('MemoryStorage not ready');
    }
    return this.#storage[key];
  }

  set(key, value) {
    if (this.#status !== 'ready') {
      throw new Error('MemoryStorage not ready');
    }
    this.#storage[key] = value;
  }

  delete(key) {
    if (this.#status !== 'ready') {
      throw new Error('MemoryStorage not ready');
    }
    delete this.#storage[key];
  }
}

function normalizeBaseUrl(url) {
  if (!url) return undefined;
  return url.endsWith('/') ? url : `${url}/`;
}

function deriveStorageKey(walletSeed) {
  if (!(walletSeed instanceof Uint8Array)) {
    throw new TypeError('walletSeed must be Uint8Array or Buffer');
  }
  return hmac(sha256, 'Coin Wallet', hex.encode(walletSeed));
}

function resolveAccountUrl(explicitUrl, baseUrl, path) {
  if (explicitUrl) {
    return explicitUrl;
  }
  if (!baseUrl) {
    return undefined;
  }
  return new URL(path, baseUrl).toString();
}

export default class Account extends EventEmitter {
  #clientStorage;
  #seeds;
  #request;
  #settings;
  #storageKey;
  #details;
  #market;
  #cryptoDB;
  #wallets = new WalletManager();
  #deviceSeed;
  #biometry;
  #passwordUnlock;
  #webAuthn;
  #exchanges;
  #needToMigrateV5Balance = false;
  #walletConnect;
  #dummy = false;
  #cryptosToSelect = undefined;

  get siteUrl() {
    const url = this.isOnion ? import.meta.env.VITE_SITE_URL_TOR : import.meta.env.VITE_SITE_URL;
    return normalizeBaseUrl(url);
  }

  get appName() {
    return import.meta.env.VITE_NAME || 'Wallet';
  }

  get supportUrl() {
    return this.isOnion ?
      import.meta.env.VITE_SUPPORT_URL_TOR || import.meta.env.VITE_SUPPORT_URL :
      import.meta.env.VITE_SUPPORT_URL;
  }

  get termsUrl() {
    const explicitUrl = this.isOnion ?
      import.meta.env.VITE_TERMS_URL_TOR || import.meta.env.VITE_TERMS_URL :
      import.meta.env.VITE_TERMS_URL;
    return resolveAccountUrl(explicitUrl, this.siteUrl, 'terms-of-service/');
  }

  get privacyUrl() {
    const explicitUrl = this.isOnion ?
      import.meta.env.VITE_PRIVACY_URL_TOR || import.meta.env.VITE_PRIVACY_URL :
      import.meta.env.VITE_PRIVACY_URL;
    return resolveAccountUrl(explicitUrl, this.siteUrl, 'privacy-policy/');
  }

  get passphraseHelpUrl() {
    return this.isOnion ?
      import.meta.env.VITE_HELP_PASSPHRASE_URL_TOR || import.meta.env.VITE_HELP_PASSPHRASE_URL :
      import.meta.env.VITE_HELP_PASSPHRASE_URL;
  }

  get walletConnectHelpUrl() {
    return this.isOnion ?
      import.meta.env.VITE_HELP_WALLETCONNECT_URL_TOR || import.meta.env.VITE_HELP_WALLETCONNECT_URL :
      import.meta.env.VITE_HELP_WALLETCONNECT_URL;
  }

  get customTokenHelpUrl() {
    return this.isOnion ?
      import.meta.env.VITE_HELP_CUSTOM_TOKEN_URL_TOR || import.meta.env.VITE_HELP_CUSTOM_TOKEN_URL :
      import.meta.env.VITE_HELP_CUSTOM_TOKEN_URL;
  }

  get shareUrl() {
    return this.siteUrl || `${window.location.origin}/`;
  }

  get clientStorage() {
    return this.#clientStorage;
  }

  get settings() {
    return this.#settings;
  }

  get details() {
    return this.#details;
  }

  get market() {
    return this.#market;
  }

  get cryptoDB() {
    return this.#cryptoDB;
  }

  get biometry() {
    return this.#biometry;
  }

  get passwordUnlock() {
    return this.#passwordUnlock;
  }

  get webAuthn() {
    return this.#webAuthn;
  }

  get exchanges() {
    return this.#exchanges;
  }

  get isCreated() {
    return this.#clientStorage.hasId()
      && this.#clientStorage.hasSeed('wallet')
      && this.#clientStorage.hasPinUnlock();
  }

  get isLocked() {
    return !this.#deviceSeed;
  }

  get isOnion() {
    return this.#clientStorage.isOnion();
  }

  get isOfflineMode() {
    return this.#settings?.isOfflineMode() || false;
  }

  get isMarketEnabled() {
    return this.#settings?.isServerFeatureEnabled('market') ?? true;
  }

  get isSwapEnabled() {
    return this.#settings?.isServerFeatureEnabled('swap') ?? true;
  }

  get user() {
    if (this.#details) {
      const user = this.#details.get('userInfo');
      let avatar;
      if (user.email) {
        const hash = hex.encode(sha256(user.email.trim().toLowerCase()));
        avatar = `gravatar:${hash}`;
      } else {
        const hash = hex.encode(hmac(sha256, 'Coin Wallet', hex.encode(this.getStorageKey())));
        avatar = `identicon:${hash}`;
      }
      return {
        ...user,
        avatar,
      };
    }
    return {};
  }

  get isHiddenBalance() {
    return this.#clientStorage.isHiddenBalance();
  }

  get isDummy() {
    return this.#dummy;
  }

  get cryptosToSelect() {
    return this.#cryptosToSelect;
  }

  get walletsNeedSynchronization() {
    return this.wallets('coin').filter((wallet) => {
      return wallet.state === CsWallet.STATE_NEED_INITIALIZATION;
    });
  }

  constructor({ localStorage, release }) {
    super();
    if (!localStorage) {
      throw new TypeError('localStorage is required');
    }

    this.#clientStorage = new ClientStorage({ localStorage });
    this.#clientStorage.cleanupLegacyKeys();
    this.#seeds = new Seeds({
      clientStorage: this.#clientStorage,
    });
    this.#request = new Request({
      clientStorage: this.#clientStorage,
      release,
    });
    this.#settings = new Settings({
      clientStorage: this.#clientStorage,
    });
    this.#cryptoDB = new CryptoDB();
    this.#market = new Market({
      cryptoDB: this.#cryptoDB,
      request: this.request,
      account: this,
    });
    this.#biometry = new Biometry({
      clientStorage: this.#clientStorage,
    });
    this.#passwordUnlock = new PasswordUnlock({
      clientStorage: this.#clientStorage,
    });
    this.#webAuthn = new WebAuthnUnlock({
      clientStorage: this.#clientStorage,
      appName: this.appName,
    });
  }

  async create(walletSeed, pin) {
    if (!(walletSeed instanceof Uint8Array)) {
      throw new TypeError('walletSeed must be Uint8Array or Buffer');
    }
    if (walletSeed.length !== 64) {
      throw new TypeError('walletSeed must be 64 bytes');
    }
    this.#clientStorage.clear();

    const deviceSeed = randomBytes(32);
    const deviceId = hex.encode(await ed25519.getPublicKey(deviceSeed));
    const pinUnlock = await createPinUnlockConfig(pin, deviceSeed);
    this.#deviceSeed = deviceSeed;
    this.#storageKey = this.getStorageKeyFromWalletSeed(walletSeed);

    this.#clientStorage.setPinUnlock(pinUnlock);
    this.#seeds.set('wallet', walletSeed, deviceSeed);
    this.#clientStorage.setId(deviceId);

    await this.#init();
    await this.#initWalletsFromDetails(walletSeed);
  }

  async open(deviceSeed) {
    this.#deviceSeed = deviceSeed;
    this.#storageKey = this.getStorageKeyFromWalletSeed(this.getWalletSeedFromDeviceSeed(deviceSeed));
    await this.#init();
    await this.#initWalletsFromDetails();
  }

  async #init() {
    await this.#settings.init();
    this.emit('update', 'settings');
    await this.#cryptoDB.init();
    this.#details = new Details({
      clientStorage: this.#clientStorage,
      key: this.getStorageKey(),
      cryptoDB: this.#cryptoDB,
    });
    await this.#details.init();
    this.emit('update', 'user');
    this.emit('update', 'language');
    this.emit('update', 'currency');
    this.emit('update', 'isHiddenBalance');

    this.#exchanges = new Exchanges({
      request: this.request,
      account: this,
    });
    if (this.isMarketEnabled) {
      try {
        await this.#initMarket();
      } catch (err) {
        console.error('Market init failed', err);
      }
    }
    if (this.isSwapEnabled) {
      try {
        await this.#exchanges.init();
      } catch (err) {
        console.error('Exchange init failed', err);
      }
    }
    this.#dummy = hex.encode(this.getStorageKey())
      === import.meta.env.VITE_DUMMY_ACCOUNT;

    this.#initCryptosToSelect();
  }

  #initCryptosToSelect() {
    let cryptos = [];
    let type;
    if (this.#details.get('cryptos') === undefined) {
      type = 'popular';
      cryptos = this.#cryptoDB.popular.filter((item) => item.supported && !item.deprecated);
    } else {
      type = 'new';
      cryptos = this.#details.getNewCryptos();
    }
    if (cryptos.length) {
      this.#cryptosToSelect = { type, cryptos };
    }
  }

  async #initWalletsFromDetails(walletSeed = undefined) {
    const cryptos = this.#details.getSupportedCryptos();
    const walletStorages = await WalletStorage.initMany(this, cryptos);
    const wallets = await Promise.all(cryptos.map(async (crypto) => {
      const wallet = await this.#createWallet({
        crypto,
        walletStorage: walletStorages[crypto._id],
      }, walletSeed);
      // save public key only for coins
      if (crypto.type === 'coin') {
        if (wallet.state === CsWallet.STATE_INITIALIZED) {
          this.#clientStorage.setPublicKey(crypto.platform, wallet.getPublicKey(), this.#deviceSeed);
        }
        this.#details.setPlatformSettings(crypto.platform, wallet.settings);
      }
      if (this.#details.needToMigrateV5Balance) {
        await this.#migrateV5Balance(wallet);
      }
      return wallet;
    }));
    this.#wallets.setMany(wallets);

    await this.#details.save();
    this.emit('update');
  }

  async #createWallet({ crypto, walletStorage, settings }, walletSeed) {
    const Wallet = await loadWalletModule(crypto.platform);
    const platform = this.#cryptoDB.platform(crypto.platform);
    const options = this.#getWalletOptions(crypto, platform, walletStorage, settings);
    const wallet = new Wallet(options);
    if (walletSeed) {
      await wallet.create(walletSeed);
    } else if (this.#clientStorage.hasPublicKey(crypto.platform)) {
      await wallet.open(this.#clientStorage.getPublicKey(crypto.platform, this.#deviceSeed));
    } else {
      wallet.state = CsWallet.STATE_NEED_INITIALIZATION;
    }
    return wallet;
  }

  getBaseURL(service) {
    if (!this.isServerFeatureEnabled(service)) {
      return undefined;
    }
    return getBaseURL(service, this.isOnion);
  }

  isServerFeatureEnabled(service) {
    return this.#settings?.isServerFeatureEnabled(service) ?? true;
  }

  #getWalletOptions(crypto, platform, storage, settings) {
    const connection = {
      node: this.getNode(crypto.platform),
      explorer: this.#settings.getExplorer(crypto.platform),
    };
    const cache = new Cache({
      crypto,
      clientStorage: this.#clientStorage,
      deviceSeed: this.#deviceSeed,
    });
    const options = {
      crypto,
      platform,
      request: this.request,
      apiNode: connection.node.baseURL,
      connection,
      cache,
      storage,
      settings: settings || this.#details.getPlatformSettings(crypto.platform),
      development: import.meta.env.DEV,
    };
    return options;
  }

  async getCustomTokenInfo(platform, address = '') {
    const token = this.#cryptoDB.getTokenByAddress(platform, address);
    if (token) return token;
    const info = await getTokenInfo(platform, this.getNode(platform), address);
    const normalizedToken = this.#cryptoDB.getTokenByAddress(platform, info.address);
    if (normalizedToken) return normalizedToken;
    return {
      _id: `${info.address}@${platform}`,
      platform,
      type: 'token',
      name: info.name,
      symbol: info.symbol,
      address: info.address,
      decimals: info.decimals,
      custom: true,
    };
  }

  async getTokenUrl(platform, address) {
    return buildExplorerUrl(platform, 'token', address, this.#settings.getExplorer(platform));
  }

  getTransactionUrl(platform, id) {
    return buildExplorerUrl(platform, 'tx', id, this.#settings.getExplorer(platform));
  }

  getAddressUrl(platform, address) {
    return buildExplorerUrl(platform, 'address', address, this.#settings.getExplorer(platform));
  }

  getNode(platform) {
    return this.#settings.getNode(platform);
  }

  wallet(id) {
    return this.#wallets.get(id);
  }

  wallets(type = '') {
    if (type) return this.#wallets.filterByType(type);
    return this.#wallets.list();
  }

  tokensByPlatform(platform) {
    return this.#wallets.tokensByPlatform(platform);
  }

  platformWallet(platform) {
    const crypto = this.#cryptoDB.platform(platform);
    if (!crypto) return undefined;
    return this.#wallets.get(crypto._id);
  }

  getAddressSettingsWallet(wallet) {
    if (wallet?.crypto?.type === 'token') {
      return this.platformWallet(wallet.crypto.platform) || wallet;
    }
    return wallet;
  }

  walletByChainId(chainId) {
    return this.#wallets.getByChainId(chainId);
  }

  hasWallet(id) {
    return this.#wallets.has(id);
  }

  toggleOnion() {
    this.#clientStorage.toggleOnion();
    this.emit('update', 'isOnion');
  }

  logout() {
    this.#deviceSeed = undefined;
    this.#storageKey = undefined;
    this.#clientStorage.clear();
    this.emit('logout');
  }

  async remove(walletSeed) {
    void walletSeed;
    this.logout();
  }

  async addWallet(crypto, walletSeed) {
    if (this.#details.hasCrypto(crypto)) {
      throw new CryptoAlreadyAddedError(crypto._id);
    }
    await this.#addWallet(crypto, walletSeed);
    try {
      await this.#initMarket();
    } catch (err) {
      console.error('Market init failed', err);
    }
    await this.#details.save();
    this.emit('update');
  }

  async addWallets(cryptos, walletSeed) {
    for (const crypto of cryptos) {
      if (this.#details.hasCrypto(crypto)) continue;
      await this.#addWallet(crypto, walletSeed);
    }
    try {
      await this.#initMarket();
    } catch (err) {
      console.error('Market init failed', err);
    }
    await this.#details.save();
    this.emit('update');
  }

  /**
   * Adding a new wallet to the account.
   * If there is a public key, then unlocking the private seed is not requested.
   */
  async #addWallet(crypto, walletSeed) {
    if (this.#clientStorage.hasPublicKey(crypto.platform)) {
      const walletStorage = await WalletStorage.initOne(this, crypto);
      this.#wallets.set(await this.#createWallet({ crypto, walletStorage }));
      this.#details.addCrypto(crypto);
    } else if (walletSeed) {
      if (crypto.type === 'coin') {
        const walletStorage = await WalletStorage.initOne(this, crypto);
        const wallet = await this.#createWallet({
          crypto,
          walletStorage,
        }, walletSeed);
        this.#wallets.set(wallet);
        this.#details.setPlatformSettings(crypto.platform, wallet.settings);
        this.#clientStorage.setPublicKey(wallet.crypto.platform, wallet.getPublicKey(), this.#deviceSeed);
        this.#details.addCrypto(crypto);
      }
      if (crypto.type === 'token') {
        const platform = this.#cryptoDB.platform(crypto.platform);
        const walletStorages = await WalletStorage.initMany(this, [crypto, platform]);
        const wallet = await this.#createWallet({
          crypto: platform,
          walletStorage: walletStorages[platform._id],
        }, walletSeed);
        this.#wallets.set(wallet);
        this.#details.setPlatformSettings(crypto.platform, wallet.settings);
        this.#clientStorage.setPublicKey(wallet.crypto.platform, wallet.getPublicKey(), this.#deviceSeed);
        this.#wallets.set(await this.#createWallet({
          crypto,
          walletStorage: walletStorages[crypto._id],
        }));
        this.#details.addCrypto(platform);
        this.#details.addCrypto(crypto);
      }
    } else {
      throw new SeedRequiredError();
    }
  }

  async #initMarket() {
    await this.#market.init({
      cryptos: this.#details.getSupportedCryptos(),
      currency: this.#details.get('systemInfo').preferredCurrency,
    });
  }

  async removeWallet(crypto) {
    if (crypto.type === 'coin') {
      const wallets = this.#wallets.filterByPlatform(crypto.platform);
      for (const wallet of wallets) {
        this.#wallets.delete(wallet.crypto._id);
        this.#details.removeCrypto(wallet.crypto);
      }
      this.#clientStorage.unsetPublicKey(crypto.platform);
    } else if (crypto.type === 'token') {
      this.#wallets.delete(crypto._id);
      this.#details.removeCrypto(crypto);
    }

    await this.#details.save();
    this.emit('update');
  }

  /**
   * Initialize wallet in NEED_INITIALIZATION state
   * 1. The wallet was added from another device
   * 2. Settings have been changed on another device
   */
  async initWallet(wallet, walletSeed) {
    await wallet.create(walletSeed);
    const publicKey = wallet.getPublicKey();
    const wallets = this.#wallets.filterByPlatform(wallet.crypto.platform);
    for (const item of wallets) {
      // wallet already initialized
      if (item !== wallet) {
        await item.open(publicKey);
      }
    }
    this.#clientStorage.setPublicKey(wallet.crypto.platform, publicKey, this.#deviceSeed);
  }

  async initWallets(wallets, walletSeed) {
    for (const wallet of wallets) {
      await this.initWallet(wallet, walletSeed);
    }
    this.emit('update');
  }

  async #createPreviewWallet(wallet, settings, walletSeed) {
    const Wallet = await loadWalletModule(wallet.crypto.platform);
    const platform = this.#cryptoDB.platform(wallet.crypto.platform);
    const connection = {
      node: this.getNode(wallet.crypto.platform),
      explorer: this.#settings.getExplorer(wallet.crypto.platform),
    };
    const cache = new MemoryCache();
    const storage = new MemoryStorage();
    await storage.init();

    const previewWallet = new Wallet({
      crypto: wallet.crypto,
      platform,
      request: this.request,
      apiNode: connection.node.baseURL,
      connection,
      cache,
      storage,
      settings,
      development: import.meta.env.DEV,
    });

    await previewWallet.create(walletSeed);
    if (wallet.isAddressTypesSupported) {
      previewWallet.addressType = wallet.addressType;
    }
    return previewWallet;
  }

  async updatePlatformSettings(wallet, settings, walletSeed) {
    const { platform } = wallet.crypto;
    const platformWallets = this.#wallets.filterByPlatform(platform);
    await Promise.all(platformWallets.map((item) => item.cleanup()));
    wallet.settings = settings;
    await wallet.create(walletSeed);
    const publicKey = wallet.getPublicKey();
    this.#clientStorage.setPublicKey(platform, publicKey, this.#deviceSeed);
    for (const platformWallet of platformWallets) {
      if (wallet !== platformWallet) {
        platformWallet.settings = settings;
        await platformWallet.open(publicKey);
      }
    }
    this.#details.setPlatformSettings(platform, settings);
    await this.#details.save();
    this.emit('update');
  }

  async inspectPlatformSettings(wallet, settings, walletSeed) {
    const previewWallet = await this.#createPreviewWallet(wallet, settings, walletSeed);
    let active = false;
    if (!active) {
      try {
        const inspection = await previewWallet.inspectAddressActivity();
        active = !!inspection?.active;
      } catch (err) {
        console.error('inspectPlatformSettings inspectAddressActivity failed', err);
      }
    }

    let balance;
    if (active) {
      try {
        await previewWallet.load();
        const { balance: loadedBalance } = previewWallet;
        balance = loadedBalance;
      } catch (err) {
        console.error('inspectPlatformSettings load failed', err);
      }
    }

    return {
      address: previewWallet.address,
      balance,
      active,
    };
  }

  async #loadPreviewBalance(wallet, settings, walletSeed) {
    const previewWallet = await this.#createPreviewWallet(wallet, settings, walletSeed);
    await previewWallet.load();
    return {
      address: previewWallet.address,
      balance: previewWallet.balance,
    };
  }

  async inspectAddressSettings(wallet, settings, walletSeed) {
    const settingsWallet = this.getAddressSettingsWallet(wallet);
    const preview = await this.inspectPlatformSettings(wallet, settings, walletSeed);
    if (settingsWallet === wallet) {
      return preview;
    }
    const linkedPreview = await this.inspectPlatformSettings(settingsWallet, settings, walletSeed);
    if ((preview.active || linkedPreview.active) && preview.balance === undefined) {
      try {
        const loadedPreview = await this.#loadPreviewBalance(wallet, settings, walletSeed);
        preview.address = preview.address || loadedPreview.address;
        preview.balance = loadedPreview.balance;
      } catch (err) {
        console.error('inspectAddressSettings loadPreviewBalance failed', err);
      }
    }
    return {
      address: preview.address || linkedPreview.address,
      balance: preview.balance,
      active: preview.active || linkedPreview.active,
    };
  }

  async updateUsername(username) {
    return username.trim();
  }

  // binded to this
  getSeed = (type, token) => {
    return this.#seeds.get(type, token);
  };

  // binded to this
  request = (config) => {
    if (config?.seed === 'device') {
      config.seed = this.#deviceSeed;
    }
    return this.#request.request({
      baseURL: this.siteUrl,
      ...config,
    });
  };

  getStorageKeyFromWalletSeed(walletSeed) {
    return deriveStorageKey(walletSeed);
  }

  getStorageKey() {
    if (!(this.#storageKey instanceof Uint8Array)) {
      throw new Error('Storage key is locked');
    }
    return this.#storageKey;
  }

  getUnlockedDeviceSeed() {
    if (!(this.#deviceSeed instanceof Uint8Array)) {
      throw new Error('Device seed is locked');
    }
    return this.#deviceSeed;
  }

  async getDeviceSeedFromPin(pin) {
    const config = this.#clientStorage.getPinUnlock();
    if (!config) {
      throw new Error('PIN unlock is not configured');
    }
    return unlockDeviceSeedWithPin(pin, config);
  }

  async getDeviceSeedFromPassword(password) {
    return this.#passwordUnlock.unlock(password);
  }

  getDeviceSeedFromBiometrySecret(secret) {
    if (typeof secret !== 'string') {
      throw new TypeError('biometry secret must be string');
    }
    return hex.decode(secret);
  }

  getWalletSeedFromDeviceSeed(deviceSeed) {
    return this.getSeed('wallet', deviceSeed);
  }

  async getWalletSeedFromPin(pin) {
    return this.getWalletSeedFromDeviceSeed(await this.getDeviceSeedFromPin(pin));
  }

  async getWalletSeedFromPassword(password) {
    return this.getWalletSeedFromDeviceSeed(await this.getDeviceSeedFromPassword(password));
  }

  async getNormalSecurityWalletSeed() {
    return this.getSeed('wallet', this.#deviceSeed);
  }

  setPlatformWalletsStateInitialized(platform, excludeWallet) {
    const wallets = this.#wallets.filterByPlatform(platform);
    for (const wallet of wallets) {
      if (wallet.state === CsWallet.STATE_LOADED && wallet !== excludeWallet) {
        wallet.state = CsWallet.STATE_INITIALIZED;
      }
    }
  }

  async #migrateV5Balance(wallet) {
    if (!this.#needToMigrateV5Balance) return;
    try {
      await wallet.load();
    } catch (err) {
      console.error(err);
    }
  }

  toggleHiddenBalance() {
    this.#clientStorage.toggleHiddenBalance();
    this.emit('update', 'isHiddenBalance');
  }

  async walletConnect() {
    if (!this.#walletConnect) {
      this.#walletConnect = import('./WalletConnect.js').then(({ WalletConnect }) => {
        return new WalletConnect({ account: this }).init();
      });
    }
    return this.#walletConnect;
  }

  async setOfflineMode(value) {
    await this.#settings.setOfflineMode(value);
    if (!value && this.isMarketEnabled) {
      try {
        await this.#initMarket();
      } catch (err) {
        console.error('Market init failed', err);
      }
    }
    if (!value && this.isSwapEnabled) {
      try {
        await this.#exchanges.init();
      } catch (err) {
        console.error('Exchange init failed', err);
      }
    }
    this.emit('update', 'settings');
    this.emit('update');
  }

  async setServerFeatureEnabled(feature, value) {
    await this.#settings.setServerFeatureEnabled(feature, value);
    if (!this.isOfflineMode && feature === 'market' && value) {
      try {
        await this.#initMarket();
      } catch (err) {
        console.error('Market init failed', err);
      }
    }
    if (!this.isOfflineMode && feature === 'swap' && value) {
      try {
        await this.#exchanges.init();
      } catch (err) {
        console.error('Exchange init failed', err);
      }
    }
    this.emit('update', 'settings');
    this.emit('update');
  }

  async setExplorer(platform, config) {
    await this.#settings.setExplorer(platform, config);
    this.#syncWalletConnections(platform);
    this.emit('update', 'settings');
  }

  async setNode(platform, config) {
    await this.#settings.setNode(platform, config);
    this.#syncWalletConnections(platform);
    this.emit('update', 'settings');
  }

  async testNode(platform, config) {
    return testNodeConnection(platform, config);
  }

  #syncWalletConnections(platform) {
    const connection = {
      node: this.getNode(platform),
      explorer: this.#settings.getExplorer(platform),
    };
    for (const wallet of this.#wallets.filterByPlatform(platform)) {
      wallet.apiNode = connection.node.baseURL;
      wallet.connection = connection;
    }
  }

  unknownError() {
    if (this.isOnion && navigator.onLine) return i18n.global.t('Error! Please ensure that your Tor VPN is active.');
    return i18n.global.t('Error! Please try again later.');
  }
}
