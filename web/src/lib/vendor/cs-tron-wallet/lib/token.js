import { Address } from 'tronlib';
import { abi, connection, errors } from '@coinspace/cs-common';

const READONLY_OWNER = '410000000000000000000000000000000000000000';

function normalizeHexAddress(address) {
  if (/^0x[0-9a-f]{40}$/i.test(address)) {
    return `41${address.slice(2)}`;
  }
  return address;
}

export function parseTronAddress(address) {
  const trimmed = address.trim();
  try {
    return Address.fromBase58Check(trimmed);
  } catch (err) {
    void err;
  }
  try {
    return Address.fromHex(normalizeHexAddress(trimmed));
  } catch (err) {
    void err;
  }
  throw new errors.InvalidAddressError(address);
}

async function tronHttp(baseURL, path, data, fetchFn) {
  const fetch = connection.getFetch(fetchFn);
  const response = await fetch(new URL(path, baseURL), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) {
    throw new Error(`Unexpected status ${response.status}`);
  }
  const json = await response.json();
  if (json?.Error) {
    throw new Error(json.Error);
  }
  return json;
}

async function triggerConstant(baseURL, contractAddress, functionSelector, fetchFn) {
  const json = await tronHttp(baseURL, 'wallet/triggerconstantcontract', {
    owner_address: READONLY_OWNER,
    contract_address: contractAddress.toHex(),
    function_selector: functionSelector,
    parameter: '',
    visible: false,
  }, fetchFn);
  const result = json?.constant_result?.[0];
  if (!json?.result?.result || !result) {
    throw new errors.AddressError('Invalid TRC20 metadata');
  }
  return result;
}

export async function loadTokenInfo(baseURL, address, fetchFn) {
  const contractAddress = parseTronAddress(address);
  try {
    const nameHex = await triggerConstant(baseURL, contractAddress, 'name()', fetchFn);
    const symbolHex = await triggerConstant(baseURL, contractAddress, 'symbol()', fetchFn);
    const decimalsHex = await triggerConstant(baseURL, contractAddress, 'decimals()', fetchFn);
    const name = abi.decodeAbiString(nameHex);
    const symbol = abi.decodeAbiString(symbolHex);
    const decimals = abi.decodeAbiUint(decimalsHex);
    if (!name || !symbol || !Number.isInteger(decimals)) {
      throw new errors.AddressError('Invalid TRC20 metadata');
    }
    return {
      address: contractAddress.toBase58Check(),
      name,
      symbol,
      decimals,
    };
  } catch (err) {
    if (err instanceof errors.AddressError) {
      throw err;
    }
    if (/contract validate error|validate signature error|invalid/i.test(err?.message || '')) {
      throw new errors.AddressError('Invalid TRC20 metadata', { cause: err });
    }
    throw err;
  }
}
