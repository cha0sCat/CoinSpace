import utils from './utils.js';

const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const TOKEN_TRANSFER_SELECTOR = '0xa9059cbb';

function hexToBigInt(value) {
  if (!value || value === '0x') return 0n;
  return BigInt(value);
}

function hexToNumber(value) {
  return Number(hexToBigInt(value));
}

function toUnixTimestamp(timestamp) {
  return Math.floor(new Date(timestamp).getTime() / 1000);
}

function normalizeAddress(address) {
  return address?.toLowerCase();
}

function encodeAddressArgument(address) {
  return address.toLowerCase().slice(2).padStart(64, '0');
}

function encodeBalanceOf(address) {
  return `0x70a08231${encodeAddressArgument(address)}`;
}

function inferAction({ input, method, value }) {
  if (input && input !== '0x') {
    if (input.startsWith(TOKEN_TRANSFER_SELECTOR)) {
      return 'tokenTransfer';
    }
    return 'smartContractCall';
  }
  if (method === 'transfer' || BigInt(value || 0) > 0n) {
    return 'transfer';
  }
  return 'smartContractCall';
}

function parseTransferLog(log) {
  if (log?.topics?.[0]?.toLowerCase() !== TRANSFER_TOPIC) return;
  if (!log.topics[1] || !log.topics[2]) return;
  return {
    from: `0x${log.topics[1].slice(-40)}`.toLowerCase(),
    to: `0x${log.topics[2].slice(-40)}`.toLowerCase(),
    value: hexToBigInt(log.data || '0x0').toString(),
  };
}

function parseTransferInput(input) {
  if (!input?.startsWith(TOKEN_TRANSFER_SELECTOR) || input.length < 138) return;
  return {
    to: `0x${input.slice(34, 74)}`.toLowerCase(),
    value: BigInt(`0x${input.slice(74, 138)}`).toString(),
  };
}

function transformHistoryTransaction(tx) {
  return {
    _id: tx.hash,
    to: normalizeAddress(tx.to?.hash || tx.created_contract?.hash),
    from: normalizeAddress(tx.from?.hash),
    value: tx.value || '0',
    timestamp: toUnixTimestamp(tx.timestamp),
    confirmations: Number(tx.confirmations || 0),
    gas: tx.gas_limit || tx.gas_used || '0',
    gasUsed: tx.gas_used || tx.gas_limit || '0',
    gasPrice: tx.gas_price || '0',
    maxFeePerGas: tx.max_fee_per_gas || undefined,
    maxPriorityFeePerGas: tx.max_priority_fee_per_gas || undefined,
    status: tx.status === 'ok',
    nonce: tx.nonce ?? 0,
    input: tx.raw_input || '0x',
    action: inferAction({
      input: tx.raw_input,
      method: tx.method,
      value: tx.value,
    }),
  };
}

function transformTokenHistoryTransaction(item, tx) {
  return {
    token: true,
    txId: item.transaction_hash,
    to: normalizeAddress(item.to?.hash),
    from: normalizeAddress(item.from?.hash),
    value: item.total?.value || '0',
    timestamp: toUnixTimestamp(tx?.timestamp || item.timestamp),
    confirmations: Number(tx?.confirmations || 0),
    gas: tx?.gas_limit || tx?.gas_used || '0',
    gasUsed: tx?.gas_used || tx?.gas_limit || '0',
    gasPrice: tx?.gas_price || '0',
    maxFeePerGas: tx?.max_fee_per_gas || undefined,
    maxPriorityFeePerGas: tx?.max_priority_fee_per_gas || undefined,
    status: tx ? tx.status === 'ok' : true,
    nonce: tx?.nonce ?? 0,
    input: tx?.raw_input || '0x',
    action: 'tokenTransfer',
  };
}

function transformRpcTransaction(tx, receipt, latestBlockNumber, block) {
  const blockNumber = tx.blockNumber ? hexToBigInt(tx.blockNumber) : 0n;
  const confirmations = blockNumber
    ? Number(latestBlockNumber - blockNumber + 1n)
    : 0;
  return {
    _id: tx.hash,
    to: normalizeAddress(tx.to),
    from: normalizeAddress(tx.from),
    value: hexToBigInt(tx.value).toString(),
    timestamp: block?.timestamp ? hexToNumber(block.timestamp) : Math.floor(Date.now() / 1000),
    confirmations,
    gas: hexToBigInt(tx.gas).toString(),
    gasUsed: receipt?.gasUsed ? hexToBigInt(receipt.gasUsed).toString() : hexToBigInt(tx.gas).toString(),
    gasPrice: hexToBigInt(receipt?.effectiveGasPrice || tx.gasPrice || '0x0').toString(),
    maxFeePerGas: tx.maxFeePerGas ? hexToBigInt(tx.maxFeePerGas).toString() : undefined,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? hexToBigInt(tx.maxPriorityFeePerGas).toString() : undefined,
    status: receipt?.status ? receipt.status !== '0x0' : null,
    nonce: hexToNumber(tx.nonce),
    input: tx.input || '0x',
    action: inferAction(tx),
  };
}

function transformRpcTokenTransaction(tokenAddress, tx, receipt, latestBlockNumber, block) {
  const transferLog = receipt?.logs?.find((log) => {
    return normalizeAddress(log.address) === tokenAddress.toLowerCase()
      && log.topics?.[0]?.toLowerCase() === TRANSFER_TOPIC;
  });
  const parsed = parseTransferLog(transferLog) || parseTransferInput(tx.input);
  if (!parsed) {
    throw new Error('Token transfer data is missing');
  }
  const blockNumber = tx.blockNumber ? hexToBigInt(tx.blockNumber) : 0n;
  const confirmations = blockNumber
    ? Number(latestBlockNumber - blockNumber + 1n)
    : 0;
  return {
    token: true,
    txId: tx.hash,
    to: parsed.to,
    from: parsed.from || normalizeAddress(tx.from),
    value: parsed.value,
    timestamp: block?.timestamp ? hexToNumber(block.timestamp) : Math.floor(Date.now() / 1000),
    confirmations,
    gas: hexToBigInt(tx.gas).toString(),
    gasUsed: receipt?.gasUsed ? hexToBigInt(receipt.gasUsed).toString() : hexToBigInt(tx.gas).toString(),
    gasPrice: hexToBigInt(receipt?.effectiveGasPrice || tx.gasPrice || '0x0').toString(),
    maxFeePerGas: tx.maxFeePerGas ? hexToBigInt(tx.maxFeePerGas).toString() : undefined,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas ? hexToBigInt(tx.maxPriorityFeePerGas).toString() : undefined,
    status: receipt?.status ? receipt.status !== '0x0' : null,
    nonce: hexToNumber(tx.nonce),
    input: tx.input || '0x',
    action: 'tokenTransfer',
  };
}

function normalizeCursor(cursor) {
  if (!cursor) {
    return {
      nextPage: undefined,
      buffer: [],
    };
  }
  if (cursor.nextPage !== undefined || Array.isArray(cursor.buffer)) {
    return {
      nextPage: cursor.nextPage,
      buffer: cursor.buffer || [],
    };
  }
  return {
    nextPage: cursor,
    buffer: [],
  };
}

function buildCursor(buffer, nextPage) {
  if (!buffer.length && !nextPage) {
    return;
  }
  return {
    buffer,
    nextPage,
  };
}

export default class API {
  #wallet;
  constructor(wallet) {
    this.#wallet = wallet;
  }

  async #rpc(method, params = []) {
    const json = await this.#wallet.requestNode({
      url: '',
      method: 'POST',
      data: {
        jsonrpc: '2.0',
        id: Date.now(),
        method,
        params,
      },
    });
    if (json?.error) {
      throw new Error(json.error.message || `RPC error: ${method}`);
    }
    return json?.result;
  }

  async #history(path, params = {}) {
    const historyBaseURL = this.#wallet.connection?.node?.historyBaseURL;
    if (!historyBaseURL) {
      return {
        items: [],
      };
    }
    return this.#wallet.requestPublic({
      baseURL: historyBaseURL,
      url: path,
      method: 'GET',
      params,
    });
  }

  async #getConfirmedBlockTag(confirmations) {
    const latest = hexToBigInt(await this.#rpc('eth_blockNumber'));
    if (!confirmations || latest <= BigInt(confirmations)) {
      return 'latest';
    }
    return `0x${(latest - BigInt(confirmations)).toString(16)}`;
  }

  async #loadHistoryTransaction(hash) {
    return this.#history(`transactions/${hash}`);
  }

  async coinBalance(address, confirmations) {
    utils.validateAddress(address);
    const confirmedTag = await this.#getConfirmedBlockTag(confirmations);
    const [balance, confirmedBalance] = await Promise.all([
      this.#rpc('eth_getBalance', [address, 'latest']),
      this.#rpc('eth_getBalance', [address, confirmedTag]),
    ]);
    return {
      balance: hexToBigInt(balance),
      confirmedBalance: hexToBigInt(confirmedBalance),
    };
  }

  async tokenBalance(token, address, confirmations) {
    utils.validateAddress(token);
    utils.validateAddress(address);
    const call = {
      to: token,
      data: encodeBalanceOf(address),
    };
    const confirmedTag = await this.#getConfirmedBlockTag(confirmations);
    const [balance, confirmedBalance] = await Promise.all([
      this.#rpc('eth_call', [call, 'latest']),
      this.#rpc('eth_call', [call, confirmedTag]),
    ]);
    return {
      balance: hexToBigInt(balance),
      confirmedBalance: hexToBigInt(confirmedBalance),
    };
  }

  async txsCount(address) {
    utils.validateAddress(address);
    return hexToBigInt(await this.#rpc('eth_getTransactionCount', [address, 'pending']));
  }

  async gasPrice() {
    return hexToBigInt(await this.#rpc('eth_gasPrice'));
  }

  async gasFees() {
    try {
      const [priorityFeeResult, feeHistoryResult] = await Promise.all([
        this.#rpc('eth_maxPriorityFeePerGas'),
        this.#rpc('eth_feeHistory', [4, 'latest', [25, 50, 75]]),
      ]);
      const priorityFee = hexToBigInt(priorityFeeResult);
      const baseFeePerGas = hexToBigInt(feeHistoryResult?.baseFeePerGas?.at(-1) || '0x0');
      const maxPriorityFeePerGas = priorityFee || 1n;
      const maxFeePerGas = (baseFeePerGas * 2n) + maxPriorityFeePerGas;
      return {
        maxFeePerGas,
        maxPriorityFeePerGas,
      };
    } catch {
      const gasPrice = await this.gasPrice();
      return {
        maxFeePerGas: gasPrice,
        maxPriorityFeePerGas: gasPrice,
      };
    }
  }

  async getAdditionalFee(token = false) {
    void token;
    return 0n;
  }

  async sendTransaction(rawtx) {
    return this.#rpc('eth_sendRawTransaction', [rawtx]);
  }

  async loadTransactions(address, cursor) {
    utils.validateAddress(address);
    const state = normalizeCursor(cursor);
    if (state.buffer.length) {
      const txs = state.buffer.slice(0, this.#wallet.txPerPage);
      const buffer = state.buffer.slice(this.#wallet.txPerPage);
      return {
        txs,
        hasMore: !!(buffer.length || state.nextPage),
        cursor: buildCursor(buffer, state.nextPage),
      };
    }
    const params = state.nextPage ? { ...state.nextPage } : { items_count: this.#wallet.txPerPage };
    const response = await this.#history(`addresses/${address}/transactions`, params);
    const allTxs = (response.items || []).map((item) => transformHistoryTransaction(item));
    const txs = allTxs.slice(0, this.#wallet.txPerPage);
    const buffer = allTxs.slice(this.#wallet.txPerPage);
    return {
      txs,
      hasMore: !!(buffer.length || response.next_page_params),
      cursor: buildCursor(buffer, response.next_page_params),
    };
  }

  async hasIndexedActivity(address) {
    utils.validateAddress(address);
    const [transactions, tokenTransfers] = await Promise.all([
      this.#history(`addresses/${address}/transactions`, { items_count: 1 }),
      this.#history(`addresses/${address}/token-transfers`, { items_count: 1 }),
    ]);
    return (transactions?.items?.length || 0) > 0 || (tokenTransfers?.items?.length || 0) > 0;
  }

  async loadTokenTransactions(token, address, cursor) {
    utils.validateAddress(token);
    utils.validateAddress(address);
    const state = normalizeCursor(cursor);
    if (state.buffer.length) {
      const txs = state.buffer.slice(0, this.#wallet.txPerPage);
      const buffer = state.buffer.slice(this.#wallet.txPerPage);
      return {
        txs,
        hasMore: !!(buffer.length || state.nextPage),
        cursor: buildCursor(buffer, state.nextPage),
      };
    }

    const txs = [];
    let nextCursor = state.nextPage;
    let pages = 0;

    while (txs.length < this.#wallet.txPerPage) {
      const params = nextCursor ? { ...nextCursor } : { items_count: this.#wallet.txPerPage };
      const response = await this.#history(`addresses/${address}/token-transfers`, params);
      const items = response.items || [];
      if (!items.length) {
        nextCursor = undefined;
        break;
      }
      const filtered = items.filter((item) => {
        return normalizeAddress(item.token?.address_hash) === token.toLowerCase();
      });
      if (filtered.length) {
        const hashes = [...new Set(filtered.map((item) => item.transaction_hash))];
        const details = await Promise.all(hashes.map((hash) => this.#loadHistoryTransaction(hash)));
        const detailMap = new Map(details.map((detail) => [detail.hash, detail]));
        filtered.forEach((item) => {
          txs.push(transformTokenHistoryTransaction(item, detailMap.get(item.transaction_hash)));
        });
      }
      if (!response.next_page_params || pages >= 19) {
        nextCursor = undefined;
        break;
      }
      nextCursor = response.next_page_params;
      pages++;
    }

    const page = txs.slice(0, this.#wallet.txPerPage);
    const buffer = txs.slice(this.#wallet.txPerPage);
    return {
      txs: page,
      hasMore: !!(buffer.length || nextCursor),
      cursor: buildCursor(buffer, nextCursor),
    };
  }

  async loadTransaction(id) {
    const [tx, receipt, latestBlockHex] = await Promise.all([
      this.#rpc('eth_getTransactionByHash', [id]),
      this.#rpc('eth_getTransactionReceipt', [id]),
      this.#rpc('eth_blockNumber'),
    ]);
    if (!tx) {
      return;
    }
    const latestBlockNumber = hexToBigInt(latestBlockHex);
    const block = tx.blockNumber
      ? await this.#rpc('eth_getBlockByNumber', [tx.blockNumber, false])
      : undefined;

    if (this.#wallet.crypto.type === 'token') {
      return transformRpcTokenTransaction(this.#wallet.crypto.address, tx, receipt, latestBlockNumber, block);
    }
    return transformRpcTransaction(tx, receipt, latestBlockNumber, block);
  }
}
