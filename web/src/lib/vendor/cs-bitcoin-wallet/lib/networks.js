import * as symbols from './symbols.js';

export default {
  mainnet: {
    bitcoin: {
      bech32: 'bc',
      bip32: {
        public: 0x0488b21e,
        private: 0x0488ade4,
      },
      bip44: "m/44'/0'/0'",
      bip49: "m/49'/0'/0'",
      bip84: "m/84'/0'/0'",
      bip125: true,
      pubKeyHash: 0x00,
      scriptHash: 0x05,
      wif: 0x80,
      dustThreshold: 546n,
      maxFeePerByte: 5000n,
      rbfFactor: 1.5,
      addressTypes: [symbols.ADDRESS_TYPE_P2WPKH, symbols.ADDRESS_TYPE_P2SH, symbols.ADDRESS_TYPE_P2PKH],
      txUrl: 'https://blockchair.com/bitcoin/transaction/${txId}?from=coinwallet',
      minConf: 3,
      minConfCoinbase: 100,
      factors: [{
        name: 'BTC',
        decimals: 8,
      }, {
        name: 'mBTC',
        decimals: 5,
      }, {
        name: 'μBTC',
        decimals: 2,
      }],
      dummyExchangeDepositAddress: 'bc1qhxtthndg70cthfasy8y4qlk9h7r3006azn9md0fad5dg9hh76nkqaufnuz',
      blocktime: 600,
    },
  },
  regtest: {
    bitcoin: {
      bech32: 'bcrt',
      bip32: {
        public: 0x043587cf,
        private: 0x04358394,
      },
      bip44: "m/44'/1'/0'",
      bip49: "m/49'/1'/0'",
      bip84: "m/84'/1'/0'",
      bip125: true,
      pubKeyHash: 0x6f,
      scriptHash: 0xc4,
      wif: 0xef,
      dustThreshold: 546n,
      maxFeePerByte: 5000n,
      rbfFactor: 1.5,
      addressTypes: [symbols.ADDRESS_TYPE_P2WPKH, symbols.ADDRESS_TYPE_P2SH, symbols.ADDRESS_TYPE_P2PKH],
      txUrl: 'https://blockchair.com/bitcoin/transaction/${txId}?from=coinwallet',
      minConf: 3,
      minConfCoinbase: 100,
      factors: [{
        name: 'BTC',
        decimals: 8,
      }, {
        name: 'mBTC',
        decimals: 5,
      }, {
        name: 'μBTC',
        decimals: 2,
      }],
      dummyExchangeDepositAddress: 'bcrt1qhxtthndg70cthfasy8y4qlk9h7r3006azn9md0fad5dg9hh76nkq8d46nh',
      blocktime: 600,
    },
  },
};
