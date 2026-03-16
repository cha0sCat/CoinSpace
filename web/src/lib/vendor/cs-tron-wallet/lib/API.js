import { parseTronAddress } from './token.js';

const READONLY_OWNER = '410000000000000000000000000000000000000000';
const DEFAULT_CHAIN_PARAMETERS = {
  getTransactionFee: 1000,
  getEnergyFee: 420,
  getCreateAccountFee: 100000,
  getCreateNewAccountFeeInSystemContract: 1000000,
};

function encodeAddressArgument(address) {
  return address.toHex(false).padStart(64, '0');
}

function encodeBigIntArgument(value) {
  return BigInt(value).toString(16).padStart(64, '0');
}

function mapChainParameters(response = {}) {
  const values = { ...DEFAULT_CHAIN_PARAMETERS };
  for (const item of response.chainParameter || []) {
    if (item.key) {
      values[item.key] = item.value ?? 0;
    }
  }
  return values;
}

export default class API {
  #wallet;
  constructor(wallet) {
    this.#wallet = wallet;
  }

  async #post(url, data = {}) {
    return this.#wallet.requestNode({
      url,
      method: 'POST',
      data,
    });
  }

  async #history(url, params = {}) {
    const baseURL = this.#wallet.connection?.node?.historyBaseURL || this.#wallet.apiNode;
    return this.#wallet.requestPublic({
      baseURL,
      url,
      method: 'GET',
      params,
    });
  }

  async #triggerConstant(contractAddress, functionSelector, parameter = '', ownerAddress = READONLY_OWNER) {
    return this.#post('wallet/triggerconstantcontract', {
      owner_address: ownerAddress,
      contract_address: contractAddress,
      function_selector: functionSelector,
      parameter,
      visible: false,
    });
  }

  async coinBalance(address) {
    const account = await this.account(address);
    return account?.balance || 0;
  }

  async tokenBalance(address, token) {
    const owner = parseTronAddress(address);
    const contract = parseTronAddress(token);
    const res = await this.#triggerConstant(
      contract.toHex(),
      'balanceOf(address)',
      encodeAddressArgument(owner)
    );
    const balance = res?.constant_result?.[0];
    if (!res?.result?.result || !balance) {
      return '0';
    }
    return BigInt(`0x${balance}`).toString();
  }

  async latestBlock() {
    const latestBlock = await this.#post('wallet/getnowblock', {});
    return {
      blockID: latestBlock.blockID,
      blockNumber: latestBlock.block_header?.raw_data?.number,
      blockTimestamp: latestBlock.block_header?.raw_data?.timestamp,
    };
  }

  async chainParameters() {
    return mapChainParameters(await this.#post('wallet/getchainparameters', {}));
  }

  async account(address) {
    const parsed = parseTronAddress(address);
    const data = await this.#post('wallet/getaccount', {
      address: parsed.toHex(),
      visible: false,
    });
    if (!data?.address) {
      return null;
    }
    return data;
  }

  async resources(address) {
    const [account, resource] = await Promise.all([
      this.account(address),
      this.#post('wallet/getaccountresource', {
        address: parseTronAddress(address).toHex(),
        visible: false,
      }),
    ]);
    return {
      ...resource,
      freeNetLimit: resource?.freeNetLimit || DEFAULT_CHAIN_PARAMETERS.getFreeNetLimit || 600,
      freeNetUsed: account?.free_net_usage || 0,
      EnergyLimit: resource?.EnergyLimit || 0,
      EnergyUsed: account?.account_resource?.energy_usage || 0,
    };
  }

  async estimateEnergy(token, from, to, value) {
    const owner = parseTronAddress(from);
    const destination = parseTronAddress(to);
    const contract = parseTronAddress(token);
    const data = {
      owner_address: owner.toHex(),
      contract_address: contract.toHex(),
      function_selector: 'transfer(address,uint256)',
      parameter: `${encodeAddressArgument(destination)}${encodeBigIntArgument(value)}`,
      visible: false,
    };
    try {
      const response = await this.#post('wallet/estimateenergy', data);
      if (response?.result?.result && typeof response.energy_required === 'number') {
        return response.energy_required;
      }
    } catch (err) {
      void err;
    }

    const fallback = await this.#post('wallet/triggerconstantcontract', data);
    if (fallback?.result?.result && typeof fallback.energy_used === 'number') {
      return fallback.energy_used;
    }
    throw new Error('Unable to estimate token transfer energy');
  }

  async submitTransaction(transaction) {
    const res = await this.#post('wallet/broadcasthex', {
      transaction,
    });
    if (res?.result === true) {
      return {
        code: 'SUCCESS',
        txid: res.txid,
      };
    }
    return {
      code: res?.code || res?.Error || 'ERROR',
      message: res?.message,
    };
  }

  async loadTransactions(address, limit, cursor, { minTimestamp } = {}) {
    return this.#history(`v1/accounts/${address}/transactions`, {
      limit,
      fingerprint: cursor,
      only_confirmed: false,
      order_by: 'block_timestamp,desc',
      min_timestamp: minTimestamp,
    });
  }

  async loadTokenTransactions(address, token, limit, cursor, { minTimestamp } = {}) {
    return this.#history(`v1/accounts/${address}/transactions/trc20`, {
      contract_address: token,
      limit,
      fingerprint: cursor,
      order_by: 'block_timestamp,desc',
      min_timestamp: minTimestamp,
    });
  }

  async hasIndexedActivity(address) {
    const [transactions, tokenTransactions] = await Promise.all([
      this.loadTransactions(address, 1),
      this.#history(`v1/accounts/${address}/transactions/trc20`, {
        limit: 1,
        order_by: 'block_timestamp,desc',
      }),
    ]);
    return (transactions?.data?.length || 0) > 0 || (tokenTransactions?.data?.length || 0) > 0;
  }

  async loadTransaction(id) {
    const transaction = await this.#post('wallet/gettransactionbyid', {
      value: id,
    });

    if (!transaction?.txID) {
      return;
    }

    let info = await this.#post('wallet/gettransactioninfobyid', {
      value: id,
    });
    if (!info?.blockNumber && !info?.receipt && !info?.fee) {
      info = await this.#post('wallet/gettransactioninfobyid', {
        value: id,
      });
    }
    const latestBlock = info?.blockNumber ? await this.latestBlock() : {};
    const fee = info?.fee || info?.receipt?.net_fee || 0;
    const blockNumber = info?.blockNumber;
    const confirmations = blockNumber
      ? (latestBlock.blockNumber - blockNumber + 1)
      : 0;
    return {
      ...transaction,
      blockNumber,
      block_timestamp: info?.blockTimeStamp || transaction.raw_data?.timestamp,
      confirmations,
      ret: [{
        ...transaction.ret?.[0],
        fee,
        contractRet: transaction.ret?.[0]?.contractRet || info?.receipt?.result || 'SUCCESS',
      }],
    };
  }
}
