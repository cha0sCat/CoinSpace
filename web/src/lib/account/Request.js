import Axios from 'axios';
import axiosRetry from 'axios-retry';
import buildURL from 'axios/unsafe/helpers/buildURL.js';
import combineURLs from 'axios/unsafe/helpers/combineURLs.js';
import { errors } from '@coinspace/cs-common';

import { ed25519 } from '@noble/curves/ed25519';
import { hex } from '@scure/base';
import { sha256 } from '@noble/hashes/sha256';

export default class Request {
  #clientStorage;
  #release;
  #axios;

  constructor({ clientStorage, release }) {
    if (!clientStorage) {
      throw new TypeError('clientStorage is required');
    }
    this.#clientStorage = clientStorage;
    this.#release = release;

    const axios = Axios.create({ timeout: 30000 });
    axiosRetry(axios, {
      retries: 3,
      retryDelay(retryCount, error) {
        if (error.response?.status === 429) {
          const retryAfter = Number(error.response.headers?.['retry-after']);
          if (Number.isFinite(retryAfter) && retryAfter > 0) {
            return retryAfter * 1000;
          }
          return 3000 * retryCount;
        }
        return axiosRetry.exponentialDelay(retryCount, error);
      },
      shouldResetTimeout: true,
      retryCondition(error) {
        return axiosRetry.isNetworkOrIdempotentRequestError(error)
          || error.response?.status === 429;
      },
    });
    this.#axios = axios;
  }

  async request(config = {}) {
    const isPublic = config.public === true;
    if (config.baseURL) {
      config.url = combineURLs(config.baseURL, config.url);
      delete config.baseURL;
    }
    if (!config.method) {
      config.method = 'get';
    } else {
      config.method = config.method.toLowerCase();
    }
    if (!isPublic && ((config.seed && config.id !== false) || config.id === true)) {
      config.params = {
        ...config.params,
        id: this.#clientStorage.getId(),
      };
    }
    if (config.params) {
      config.url = buildURL(config.url, config.params);
      delete config.params;
    }

    config.headers = config.headers || {};
    if (!isPublic) {
      const date = (new Date()).toUTCString();
      config.headers['X-Release'] = this.#release;
      config.headers['X-Date'] = date;
      if (config.seed) {
        if (!(config.seed instanceof Uint8Array)) {
          throw new TypeError('seed must be Uint8Array');
        }

        const body = config.data && JSON.stringify(config.data);
        const base = [
          config.method,
          config.url,
          date,
          this.#release,
        ];
        if (config.method !== 'get' && body) {
          base.push(hex.encode(sha256(body)));
        }

        const signature = await ed25519.sign(new TextEncoder().encode(base.join(' ')), config.seed, {
          privLengthCheck: false,
        });
        config.headers.Signature = hex.encode(signature);
      }
    }

    if (config.seed && isPublic) {
      delete config.seed;
    }
    delete config.public;

    try {
      const { data } = await this.#axios.request(config);
      return data;
    } catch (err) {
      if (err.response?.status === 500) {
        throw new errors.NodeError(err);
      } else if (err.response?.data) {
        throw new errors.RequestError(err);
      } else if (err.request) {
        throw new errors.NetworkError(err);
      }
      throw err;
    }
  }
}
