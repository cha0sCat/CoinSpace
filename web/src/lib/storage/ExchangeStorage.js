import LocalStorageStore from './LocalStorageStore.js';

export default class ExchangeStorage extends LocalStorageStore {
  get defaults() {
    return {
      exchanges: [],
    };
  }

  constructor({ clientStorage, name, key }) {
    super({
      clientStorage,
      keyName: `exchange:${name}`,
      key,
    });
  }

  static async initMany(account, exchanges = []) {
    const result = {};
    if (exchanges.length === 0) return result;

    for (const exchange of exchanges) {
      const storage = new ExchangeStorage({
        clientStorage: account.clientStorage,
        name: exchange.id,
        key: account.getStorageKey(),
      });
      await storage.init();
      result[exchange.id] = storage;
    }
    return result;
  }
}
