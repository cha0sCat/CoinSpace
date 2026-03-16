import stringify from 'fast-json-stable-stringify';

export default class LocalStorageStore {
  #status = undefined;
  #clientStorage;
  #keyName;
  #key;
  #storage;
  #json;

  constructor({ clientStorage, keyName, key }) {
    if (!clientStorage) {
      throw new TypeError('clientStorage is required');
    }
    if (!keyName) {
      throw new TypeError('keyName is required');
    }
    if (key !== undefined && !(key instanceof Uint8Array)) {
      throw new TypeError('key must be Uint8Array or Buffer');
    }
    this.#clientStorage = clientStorage;
    this.#keyName = keyName;
    this.#key = key;
  }

  get defaults() {
    return {};
  }

  async init(data) {
    if (this.#status !== undefined) {
      throw new Error('LocalStorageStore already initialized');
    }
    this.#status = 'initializing';

    if (data === undefined && this.#clientStorage.hasStore(this.#keyName)) {
      data = this.#clientStorage.getStore(this.#keyName, { token: this.#key });
    }

    if (data !== undefined) {
      this.#json = data;
      this.#storage = JSON.parse(data);
    } else {
      this.#storage = this.defaults;
      this.#json = stringify(this.#storage);
    }
    this.#status = 'ready';
  }

  async save() {
    if (this.#status !== 'ready') {
      throw new Error('LocalStorageStore not ready');
    }
    const json = stringify(this.#storage);
    if (json === this.#json) {
      return;
    }
    this.#status = 'saving';
    this.#clientStorage.setStore(this.#keyName, json, {
      token: this.#key,
    });
    this.#json = json;
    this.#status = 'ready';
  }

  get(key) {
    if (this.#status !== 'ready') {
      throw new Error('LocalStorageStore not ready');
    }
    if (key === undefined) {
      throw new TypeError('key must be set');
    }
    return this.#storage[key];
  }

  set(key, value) {
    if (this.#status !== 'ready') {
      throw new Error('LocalStorageStore not ready');
    }
    if (key === undefined) {
      throw new TypeError('key must be set');
    }
    this.#storage[key] = value;
  }

  delete(key) {
    if (this.#status !== 'ready') {
      throw new Error('LocalStorageStore not ready');
    }
    if (key === undefined) {
      throw new TypeError('key must be set');
    }
    delete this.#storage[key];
  }
}
