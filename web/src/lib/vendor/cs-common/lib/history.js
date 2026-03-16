function defaultId(tx = {}) {
  return tx?.id;
}

export function normalizeHistoryCursor(cursor) {
  if (!cursor) {
    return {
      cacheOffset: 0,
      remoteCursor: undefined,
    };
  }
  if (typeof cursor === 'object' && cursor.cacheOffset !== undefined) {
    return {
      cacheOffset: Number(cursor.cacheOffset) || 0,
      remoteCursor: cursor.remoteCursor,
    };
  }
  return {
    cacheOffset: 0,
    remoteCursor: cursor,
  };
}

export function buildHistoryCursor(cacheOffset, remoteCursor) {
  if (cacheOffset === undefined && remoteCursor === undefined) return;
  return {
    cacheOffset,
    remoteCursor,
  };
}

export function mergeHistory(head = [], tail = [], getId = defaultId) {
  const merged = [];
  const seen = new Set();
  for (const tx of [...head, ...tail]) {
    const id = getId(tx);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    merged.push(tx);
  }
  return merged;
}

export class HistoryCache {
  #storage;
  #getId;
  #key;
  #loaded = false;
  #owner;
  #items = [];
  #cursor;
  #meta = {};

  constructor({ storage, getId = defaultId, key = 'history' } = {}) {
    if (!storage) {
      throw new TypeError('storage is required');
    }
    this.#storage = storage;
    this.#getId = getId;
    this.#key = key;
  }

  get items() {
    return this.#items;
  }

  get cursor() {
    return this.#cursor;
  }

  set cursor(cursor) {
    this.#cursor = cursor;
  }

  get loaded() {
    return this.#loaded;
  }

  get meta() {
    return this.#meta;
  }

  set meta(meta) {
    this.#meta = meta && typeof meta === 'object' ? meta : {};
  }

  async load(owner) {
    if (this.#loaded && this.#owner === owner) return;
    const history = this.#storage.get(this.#key);
    if (history?.owner === owner && Array.isArray(history.items)) {
      this.#items = history.items;
      this.#cursor = history.cursor;
      this.meta = history.meta;
    } else {
      this.#items = [];
      this.#cursor = undefined;
      this.#meta = {};
    }
    this.#owner = owner;
    this.#loaded = true;
  }

  async save(owner) {
    this.#owner = owner;
    this.#storage.set(this.#key, {
      owner,
      items: this.#items,
      cursor: this.#cursor,
      meta: this.#meta,
    });
    await this.#storage.save();
  }

  replace(items = [], cursor, meta = this.#meta) {
    this.#items = items;
    this.#cursor = cursor;
    this.meta = meta;
  }

  append(items = [], cursor, meta = this.#meta) {
    this.#items.push(...items);
    this.#cursor = cursor;
    this.meta = meta;
  }

  merge(items = [], cursor, meta = this.#meta) {
    this.#items = mergeHistory(items, this.#items, this.#getId);
    this.#cursor = cursor;
    this.meta = meta;
  }

  find(id) {
    return this.#items.find((tx) => this.#getId(tx) === id);
  }

  page(offset, limit) {
    const items = this.#items.slice(offset, offset + limit);
    const nextOffset = offset + items.length;
    const hasMore = nextOffset < this.#items.length || this.#cursor !== undefined;
    return {
      items,
      hasMore,
      cursor: hasMore ? buildHistoryCursor(nextOffset, this.#cursor) : undefined,
    };
  }
}
