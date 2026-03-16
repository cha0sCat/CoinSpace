export default class Transactions {
  #wallet;
  #cache = new Map();
  #seen = new Map();
  #seenCounter = 0;
  constructor(wallet) {
    this.#wallet = wallet;
  }

  remember(tx) {
    if (!tx?.txid) return;
    this.#cache.set(tx.txid, tx);
    if (!this.#seen.has(tx.txid)) {
      this.#seen.set(tx.txid, this.#seenCounter++);
    }
  }

  hydrate(txs = []) {
    txs.forEach((tx) => this.remember(tx));
  }

  export(txIds = []) {
    const ids = txIds.length ? txIds : [...this.#cache.keys()];
    return ids.map((txId) => this.#cache.get(txId)).filter(Boolean);
  }

  async getRaw(txIds) {
    if (!txIds.length) return [];
    const uniqueIds = [...new Set(txIds)];
    const missing = uniqueIds.filter((txId) => !this.#cache.has(txId));
    if (missing.length) {
      const fetched = await Promise.all(missing.map((txId) => {
        return this.#wallet.requestNode({
          method: 'GET',
          url: `tx/${txId}`,
        });
      }));
      fetched.forEach((tx) => this.remember(tx));
    }
    return txIds.map((txId) => this.#cache.get(txId)).filter(Boolean);
  }

  async #getTipHeight() {
    return Number(await this.#wallet.requestNode({
      method: 'GET',
      url: 'blocks/tip/height',
    }));
  }

  #toLegacyTx(tx, tipHeight) {
    const confirmations = tx.status?.confirmed && tx.status?.block_height
      ? (tipHeight - tx.status.block_height + 1)
      : 0;
    return {
      txid: tx.txid,
      vin: tx.vin.map((input) => {
        return {
          addr: input.prevout?.scriptpubkey_address,
          valueSat: input.prevout?.value || 0,
          sequence: input.sequence,
          vout: input.vout,
          txid: input.txid,
        };
      }),
      vout: tx.vout.map((output, index) => {
        return {
          scriptPubKey: {
            addresses: output.scriptpubkey_address ? [output.scriptpubkey_address] : [],
          },
          valueSat: output.value,
          vout: index,
          csfee: false,
        };
      }),
      fees: Number(tx.fee || 0) / 1e8,
      time: tx.status?.block_time || 0,
      confirmations,
      coinbase: tx.vin.some((input) => input.is_coinbase),
    };
  }

  async sortedTxIds(txIds) {
    if (!txIds.length) return [];
    const txs = await this.getRaw(txIds);
    return [...txs].sort((a, b) => {
      const aPending = !a.status?.confirmed;
      const bPending = !b.status?.confirmed;
      if (aPending !== bPending) {
        return aPending ? -1 : 1;
      }
      if (aPending && bPending) {
        return (this.#seen.get(a.txid) || 0) - (this.#seen.get(b.txid) || 0);
      }
      const timeDiff = (b.status?.block_time || 0) - (a.status?.block_time || 0);
      if (timeDiff !== 0) return timeDiff;
      return (b.status?.block_height || 0) - (a.status?.block_height || 0);
    }).map((tx) => tx.txid);
  }

  async get(txIds) {
    if (!txIds.length) return [];
    const [txs, tipHeight] = await Promise.all([
      this.getRaw(txIds),
      this.#getTipHeight(),
    ]);
    return txs.map((tx) => this.#toLegacyTx(tx, tipHeight));
  }

  async propagate(hex) {
    const txId = await this.#wallet.requestNode({
      method: 'POST',
      url: 'tx',
      headers: {
        'content-type': 'text/plain',
      },
      data: hex,
    });
    return txId;
  }
}
