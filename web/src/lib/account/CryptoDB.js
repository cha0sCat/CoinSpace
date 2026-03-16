import { SUPPORTED_PLATFORMS } from '../constants.js';

import { deepFreeze } from '../helpers.js';

import femver from '@suchipi/femver';

import staticCryptos from '../staticCryptos.js';

export default class CryptoDB {
  #db;
  #platforms = new Map();
  #new = [];
  #popular = [];

  get all() {
    return this.#db;
  }

  get new() {
    return this.#new;
  }

  get popular() {
    return this.#popular;
  }

  #isSupported(crypto) {
    if (crypto.supported === false) {
      return false;
    } else if (SUPPORTED_PLATFORMS.includes(crypto.platform)) {
      if (typeof crypto.supported === 'string' && femver.isValid(crypto.supported)) {
        return femver.gte(import.meta.env.VITE_VERSION, crypto.supported);
      }
      return true;
    }
    return false;
  }

  constructor() {
  }

  async init() {
    this.#db = staticCryptos.map((item) => ({ ...item }));
    for (const item of this.#db) {
      item.supported = this.#isSupported(item);
      deepFreeze(item);
      if (item.type === 'coin') {
        this.#platforms.set(item.platform, item);
      }
      if (item.meta.new) {
        this.#new.push(item);
      }
      if (item.meta.popular) {
        this.#popular.push(item);
      }
    }
    this.#new.sort((a, b) => a.meta.new - b.meta.new);
    this.#popular.sort((a, b) => a.meta.popular - b.meta.popular);
  }

  get(id) {
    return this.#db.find((item) => item._id === id);
  }

  platform(platform) {
    return this.#platforms.get(platform);
  }

  platforms(platforms) {
    const result = [];
    for (const item of this.#platforms.values()) {
      if (platforms.includes(item.platform)) {
        result.push(item);
      }
    }
    return result;
  }

  getTokenByAddress(platform, address) {
    return this.#db
      .find((item) => item.type === 'token' && item.platform === platform && item.address === address);
  }
}
