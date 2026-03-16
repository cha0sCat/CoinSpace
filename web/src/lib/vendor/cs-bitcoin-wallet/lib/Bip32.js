const BATCH_SIZE = 3;
const BATCH_SIZE_MAX = 10;

export default class Bip32 {
  #api;
  #cache;
  #accounts;
  #getAddressFromPublicKeyBuffer;

  constructor({ accounts, api, cache, getAddressFromPublicKeyBuffer }) {
    this.#accounts = accounts;
    this.#api = api;
    this.#cache = cache;
    this.#getAddressFromPublicKeyBuffer = getAddressFromPublicKeyBuffer;
  }

  async load({ includeUnspents = true } = {}) {
    let unspentAddresses = [];
    let active = false;

    for (const [type, account] of this.#accounts) {
      const external = await this.#discover(account.external, type);
      const internal = await this.#discover(account.internal, type);

      account.addresses = external.addresses;
      account.changeAddresses = internal.addresses;
      unspentAddresses = unspentAddresses.concat(external.unspentAddresses, internal.unspentAddresses);

      this.#cache.set(`deriveIndex.${type.description}`, account.addresses.length);
      active = active || external.addresses.length > 0 || internal.addresses.length > 0;
    }

    const unspents = includeUnspents
      ? await this.#api.addresses.unspents(unspentAddresses)
      : [];

    return {
      unspents,
      active,
    };
  }

  async #discover(account, type) {
    let batchSize = BATCH_SIZE;
    let k = 0;

    let usedAddress = true;

    const addresses = [];
    const unspentAddresses = [];

    while (usedAddress) {
      const batch = [];
      for (let i = 0; i < batchSize; i++) {
        batch.push(this.#getAddressFromPublicKeyBuffer(account.deriveChild(k).publicKey, type));
        k++;
      }
      const infos = await this.#api.addresses.info(batch);
      const batchAddresses = [];
      let lastUsed = 0;
      infos.forEach((info, i) => {
        batchAddresses.push(info.address);
        if (info.txCount > 0) {
          lastUsed = i + 1;
        }
        if (info.balance > 0) {
          unspentAddresses.push(info.address);
        }
      });

      addresses.push(...batchAddresses.slice(0, lastUsed));
      usedAddress = lastUsed > 0;
      batchSize++;
      batchSize = Math.min(batchSize, BATCH_SIZE_MAX);
    }
    return {
      addresses,
      unspentAddresses,
    };
  }
}
