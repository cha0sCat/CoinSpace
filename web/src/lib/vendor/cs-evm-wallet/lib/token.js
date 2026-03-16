import { abi, connection, errors } from '@coinspace/cs-common';

function evmRpc(baseURL, method, params, fetchFn) {
  const fetch = connection.getFetch(fetchFn);
  return fetch(baseURL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  }).then(async (response) => {
    if (!response.ok) {
      throw new Error(`Unexpected status ${response.status}`);
    }
    const json = await response.json();
    if (json.error) {
      throw new Error(json.error.message || 'RPC error');
    }
    return json.result;
  });
}

async function ethCall(baseURL, address, data, fetchFn) {
  return evmRpc(baseURL, 'eth_call', [{
    to: address,
    data,
  }, 'latest'], fetchFn);
}

export function isEvmAddress(address) {
  return /^0x[a-f0-9]{40}$/i.test(address);
}

export async function loadTokenInfo(baseURL, address, fetchFn) {
  if (!isEvmAddress(address)) {
    throw new errors.InvalidAddressError(address);
  }
  try {
    const nameHex = await ethCall(baseURL, address, '0x06fdde03', fetchFn);
    const symbolHex = await ethCall(baseURL, address, '0x95d89b41', fetchFn);
    const decimalsHex = await ethCall(baseURL, address, '0x313ce567', fetchFn);
    const name = abi.decodeAbiString(nameHex);
    const symbol = abi.decodeAbiString(symbolHex);
    const decimals = abi.decodeAbiUint(decimalsHex);
    if (!name || !symbol || !Number.isInteger(decimals)) {
      throw new errors.AddressError('Invalid ERC20 metadata');
    }
    return {
      address: address.toLowerCase(),
      name,
      symbol,
      decimals,
    };
  } catch (err) {
    if (err instanceof errors.AddressError) {
      throw err;
    }
    if (err?.message === 'RPC error' || /execution reverted|invalid opcode|invalid jump/i.test(err?.message || '')) {
      throw new errors.AddressError('Invalid ERC20 metadata', { cause: err });
    }
    throw err;
  }
}
