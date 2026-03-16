import Unspent from '../Unspent.js';

export default class Addresses {
  #wallet;
  #transactions;
  constructor(wallet, transactions) {
    this.#wallet = wallet;
    this.#transactions = transactions;
  }

  async #loadAddressTransactions(address, { stopTxIds } = {}) {
    const txIds = [];
    const stopSet = stopTxIds ? new Set(stopTxIds) : undefined;
    const remember = (txs = []) => {
      let reachedBoundary = false;
      txs.forEach((tx) => {
        this.#transactions.remember(tx);
        txIds.push(tx.txid);
        if (stopSet?.has(tx.txid)) {
          reachedBoundary = true;
        }
      });
      return reachedBoundary;
    };

    const txs = await this.#wallet.requestNode({
      method: 'GET',
      url: `address/${address}/txs`,
    });
    let reachedBoundary = remember(txs);

    let lastSeen = reachedBoundary
      ? undefined
      : txs.filter((tx) => tx.status?.confirmed).at(-1)?.txid;

    while (lastSeen) {
      const page = await this.#wallet.requestNode({
        method: 'GET',
        url: `address/${address}/txs/chain/${lastSeen}`,
      });
      if (!page.length) break;
      reachedBoundary = remember(page);
      if (reachedBoundary) break;
      lastSeen = page.filter((tx) => tx.status?.confirmed).at(-1)?.txid;
    }

    return [...new Set(txIds)];
  }

  async info(addresses, { includeTxIds = false } = {}) {
    const results = [];
    for (const address of addresses) {
      const summary = await this.#wallet.requestNode({
        method: 'GET',
        url: `address/${address}`,
      });
      const chainStats = summary.chain_stats || {};
      const mempoolStats = summary.mempool_stats || {};
      const txCount = (chainStats.tx_count || 0) + (mempoolStats.tx_count || 0);
      const txIds = includeTxIds && txCount > 0
        ? await this.#loadAddressTransactions(address)
        : [];
      results.push({
        address,
        balance: BigInt((chainStats.funded_txo_sum || 0) + (mempoolStats.funded_txo_sum || 0))
          - BigInt((chainStats.spent_txo_sum || 0) + (mempoolStats.spent_txo_sum || 0)),
        txCount,
        txIds,
      });
    }
    return results;
  }

  async txIds(addresses, options = {}) {
    if (!addresses.length) {
      return [];
    }
    const txIds = [];
    for (const address of [...new Set(addresses)]) {
      txIds.push(...await this.#loadAddressTransactions(address, options));
    }
    return [...new Set(txIds)];
  }

  async unspents(addresses) {
    if (!addresses.length) {
      return [];
    }
    const tipHeight = Number(await this.#wallet.requestNode({
      method: 'GET',
      url: 'blocks/tip/height',
    }));
    const utxos = [];
    for (const address of addresses) {
      const list = await this.#wallet.requestNode({
        method: 'GET',
        url: `address/${address}/utxo`,
      });
      utxos.push(list.map((utxo) => ({ address, ...utxo })));
    }

    const flat = utxos.flat();
    const txIds = [...new Set(flat.filter((utxo) => utxo.status?.confirmed).map((utxo) => utxo.txid))];
    const rawTxs = txIds.length ? await this.#transactions.getRaw(txIds) : [];
    const txMap = new Map(rawTxs.map((tx) => [tx.txid, tx]));

    return flat.map((utxo) => {
      const blockHeight = utxo.status?.block_height;
      const confirmations = utxo.status?.confirmed && blockHeight
        ? (tipHeight - blockHeight + 1)
        : 0;
      const rawTx = txMap.get(utxo.txid);
      return new Unspent({
        address: utxo.address,
        type: this.#wallet.getAddressType(utxo.address),
        confirmations,
        txId: utxo.txid,
        value: BigInt(utxo.value),
        vout: utxo.vout,
        coinbase: !!rawTx?.vin?.some((input) => input.is_coinbase),
      });
    });
  }
}
