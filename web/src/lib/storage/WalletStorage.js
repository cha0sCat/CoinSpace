import LocalStorageStore from './LocalStorageStore.js';

export default class WalletStorage extends LocalStorageStore {
  constructor({ clientStorage, name, key }) {
    super({
      clientStorage,
      keyName: `wallet:${name}`,
      key,
    });
  }

  static async initOne(account, crypto) {
    const storage = new WalletStorage({
      clientStorage: account.clientStorage,
      name: crypto._id,
      key: account.getStorageKey(),
    });
    await storage.init();
    return storage;
  }

  static async initMany(account, cryptos = []) {
    const result = {};
    if (cryptos.length === 0) return result;

    for (const crypto of cryptos) {
      const storage = new WalletStorage({
        clientStorage: account.clientStorage,
        name: crypto._id,
        key: account.getStorageKey(),
      });
      await storage.init();
      result[crypto._id] = storage;
    }
    return result;
  }
}
