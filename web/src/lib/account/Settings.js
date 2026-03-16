import { SUPPORTED_PLATFORMS } from '../constants.js';

import {
  getDefaultExplorer,
  getDefaultNode,
  normalizeExplorerConfig,
  normalizeNodeConfig,
} from '../connections.js';

import LocalStorageStore from '../storage/LocalStorageStore.js';

export default class Settings extends LocalStorageStore {
  constructor({ clientStorage }) {
    super({
      clientStorage,
      keyName: 'settings',
    });
  }

  get defaults() {
    const nodes = SUPPORTED_PLATFORMS.reduce((result, platform) => {
      result[platform] = getDefaultNode(platform);
      return result;
    }, {});
    const explorers = SUPPORTED_PLATFORMS.reduce((result, platform) => {
      result[platform] = getDefaultExplorer(platform);
      return result;
    }, {});
    return {
      '1faWallet': true,
      offlineMode: false,
      serverFeatures: {
        market: true,
        swap: true,
      },
      nodes,
      explorers,
    };
  }

  // sync get
  get(key) {
    if (key) {
      return super.get(key);
    }
    return {
      '1faWallet': super.get('1faWallet'),
      offlineMode: this.isOfflineMode(),
      serverFeatures: this.getServerFeatures(),
      nodes: this.getNodes(),
      explorers: this.getExplorers(),
    };
  }

  isOfflineMode() {
    return !!super.get('offlineMode');
  }

  getServerFeatures() {
    return {
      market: super.get('serverFeatures')?.market !== false,
      swap: super.get('serverFeatures')?.swap !== false,
    };
  }

  isServerFeatureEnabled(feature) {
    if (this.isOfflineMode()) return false;
    return this.getServerFeatures()[feature] !== false;
  }

  getExplorers() {
    const explorers = super.get('explorers') || {};
    return SUPPORTED_PLATFORMS.reduce((result, platform) => {
      result[platform] = normalizeExplorerConfig(platform, explorers[platform]);
      return result;
    }, {});
  }

  getNodes() {
    const nodes = super.get('nodes') || {};
    return SUPPORTED_PLATFORMS.reduce((result, platform) => {
      result[platform] = normalizeNodeConfig(platform, nodes[platform]);
      return result;
    }, {});
  }

  getNode(platform) {
    return this.getNodes()[platform] || getDefaultNode(platform);
  }

  getExplorer(platform) {
    return this.getExplorers()[platform] || getDefaultExplorer(platform);
  }

  async set(key, value, seed) {
    void seed;
    super.set(key, value);
    await super.save();
  }

  async setOfflineMode(value) {
    super.set('offlineMode', !!value);
    await super.save();
  }

  async setServerFeatureEnabled(feature, value) {
    const serverFeatures = this.getServerFeatures();
    serverFeatures[feature] = !!value;
    super.set('serverFeatures', serverFeatures);
    await super.save();
  }

  async setNode(platform, config) {
    const nodes = this.getNodes();
    nodes[platform] = normalizeNodeConfig(platform, config);
    super.set('nodes', nodes);
    await super.save();
  }

  async setExplorer(platform, config) {
    const explorers = this.getExplorers();
    explorers[platform] = normalizeExplorerConfig(platform, config);
    super.set('explorers', explorers);
    await super.save();
  }

  clientSet(key, value) {
    super.set(key, value);
    void super.save();
  }
}
