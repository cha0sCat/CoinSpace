import LocalStorageStore from './LocalStorageStore.js';
import { deepFreeze } from '../helpers.js';
import defaultCryptos from '../defaultCryptos.js';

export default class Details extends LocalStorageStore {
  #cryptoDB;

  constructor({ clientStorage, key, cryptoDB }) {
    super({
      clientStorage,
      keyName: 'details',
      key,
    });
    this.#cryptoDB = cryptoDB;
  }

  get defaults() {
    return {
      systemInfo: { preferredCurrency: 'USD' },
      userInfo: {
        username: '',
        email: '',
      },
      cryptos: undefined,
      shownNewCryptoIds: [],
    };
  }

  #migrateV5Details() {
    const cryptoSettings = this.get('cryptoSettings');
    if (cryptoSettings) {
      const platformSettings = Object.keys(cryptoSettings).reduce((result, id) => {
        const crypto = this.#cryptoDB.get(id);
        if (crypto) result[crypto.platform] = cryptoSettings[id];
        return result;
      }, {});
      const legacy = {
        'ethereum@ethereum': { bip44: 'm' },
        'bitcoin@bitcoin': {
          bip84: "m/84'/0'/0'",
          bip49: "m/49'/0'/0'",
          bip44: "m/0'",
        },
      };
      Object.keys(legacy).forEach((id) => {
        const crypto = this.#cryptoDB.get(id);
        if (crypto && !platformSettings[crypto.platform]) {
          platformSettings[crypto.platform] = legacy[id];
        }
      });
      this.set('platformSettings', platformSettings);
      this.delete('cryptoSettings');
    }
    const tokens = this.get('tokens');
    if (tokens) {
      this.needToMigrateV5Balance = true;
      const cryptos = [
        ...defaultCryptos,
        ...tokens.filter((crypto) => {
          return crypto?._id?.includes('@') && !defaultCryptos.find((token) => token._id === crypto._id);
        }),
      ];
      this.setCryptos(cryptos);
      this.delete('tokens');
    }
  }

  #updateExistedCryptosAndMigrateCustomTokens() {
    if (this.get('cryptos') !== undefined) {
      const cryptos = this.get('cryptos').map((local) => {
        const remote = this.#cryptoDB.get(local._id)
          || (local.type === 'token' ? this.#cryptoDB.getTokenByAddress(local.platform, local.address) : undefined);
        return remote || local;
      });
      this.setCryptos(cryptos);
    }
  }

  #fixAddTokenPlatforms() {
    if (this.get('cryptos') !== undefined) {
      const cryptos = this.get('cryptos');
      cryptos.forEach((crypto) => {
        if (crypto.type === 'token') {
          const platform = cryptos.find((item) => item.type === 'coin' && item.platform === crypto.platform);
          if (!platform) cryptos.push(this.#cryptoDB.platform(crypto.platform));
        }
      });
      this.setCryptos(cryptos);
    }
  }

  async init() {
    await super.init();
    this.#migrateV5Details();
    this.#updateExistedCryptosAndMigrateCustomTokens();
    this.#fixAddTokenPlatforms();
  }

  getPlatformSettings(key) {
    if (!key) {
      throw new TypeError('settings key must be specified');
    }
    const settings = this.get('platformSettings') || {};
    return settings[key] || {};
  }

  setPlatformSettings(key, value) {
    if (!key) {
      throw new TypeError('settings key must be specified');
    }
    const settings = this.get('platformSettings') || {};
    return this.set('platformSettings', {
      ...settings,
      [key]: value,
    });
  }

  getCryptos() {
    return (this.get('cryptos') || []).map((crypto) => {
      const remote = this.#cryptoDB.get(crypto._id);
      return remote || deepFreeze({
        ...crypto,
        custom: true,
        supported: crypto.type === 'token'
          ? (this.#cryptoDB.platform(crypto.platform)?.supported)
          : false,
      });
    });
  }

  getSupportedCryptos() {
    return this.getCryptos().filter((item) => item.supported);
  }

  setCryptos(cryptos) {
    this.set('cryptos', cryptos.map(({ _id, asset, platform, type, name, symbol, address, decimals, logo }) => {
      return {
        _id,
        asset,
        platform,
        type,
        name,
        symbol,
        address,
        decimals,
        logo,
      };
    }));
  }

  hasCrypto(crypto) {
    return this.getCryptos().some((item) => item._id === crypto._id);
  }

  addCrypto(crypto) {
    const cryptos = this.getCryptos();
    if (!this.hasCrypto(crypto)) {
      cryptos.push(crypto);
    }
    this.setCryptos(cryptos);
  }

  removeCrypto(crypto) {
    this.set('cryptos', this.getCryptos().filter((item) => item._id !== crypto._id));
  }

  getNewCryptos() {
    const cryptoIds = new Set((this.get('cryptos') || []).map(({ _id }) => _id));
    const shownNewCryptoIds = new Set(this.get('shownNewCryptoIds') || []);
    const newCryptos = this.#cryptoDB.new;
    const cryptosToShow = [];
    for (const crypto of newCryptos) {
      if (crypto.supported && !crypto.deprecated) {
        if (!cryptoIds.has(crypto._id) && !shownNewCryptoIds.has(crypto._id)) {
          cryptosToShow.push(crypto);
        }
      }
    }
    return cryptosToShow;
  }

  setShownNewCryptoIds() {
    const shownNewCryptoIds = new Set(this.get('shownNewCryptoIds') || []);
    const newCryptos = this.#cryptoDB.new;
    for (const crypto of newCryptos) {
      if (crypto.supported && !crypto.deprecated) {
        shownNewCryptoIds.add(crypto._id);
      }
    }
    for (const id of shownNewCryptoIds) {
      if (!newCryptos.find((item) => item._id === id)) {
        shownNewCryptoIds.delete(id);
      }
    }
    this.set('shownNewCryptoIds', [...shownNewCryptoIds]);
  }
}
