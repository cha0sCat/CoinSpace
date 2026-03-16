export function normalizeBaseURL(baseURL = '') {
  const trimmed = baseURL.trim();
  if (!trimmed) {
    return '';
  }
  const url = new URL(trimmed);
  const href = url.toString();
  return href.endsWith('/') ? href : `${href}/`;
}

export function normalizeOptionalBaseURL(baseURL = '') {
  if (!baseURL?.trim()) {
    return '';
  }
  return normalizeBaseURL(baseURL);
}

export function getPreset(presets = [], preset) {
  return presets.find((item) => item.value === preset);
}

export function getPresetOptions(presets = []) {
  return presets.map(({ value, name }) => ({ value, name }));
}

export function getDefaultPresetConfig(presets = [], extraFields = []) {
  const preset = presets.find((item) => item.value !== 'custom');
  if (!preset) {
    return extraFields.reduce((config, field) => {
      config[field] = undefined;
      return config;
    }, {
      preset: 'custom',
      baseURL: '',
    });
  }
  return extraFields.reduce((config, field) => {
    config[field] = preset[field];
    return config;
  }, {
    preset: preset.value,
    baseURL: normalizeBaseURL(preset.baseURL),
  });
}

export function normalizePresetConfig(presets = [], config = {}, extraFields = []) {
  const fallback = getDefaultPresetConfig(presets, extraFields);
  if (config.preset === 'custom') {
    if (!config.baseURL?.trim()) {
      throw new TypeError('baseURL is required');
    }
    return extraFields.reduce((normalized, field) => {
      normalized[field] = config[field] ?? fallback[field];
      return normalized;
    }, {
      preset: 'custom',
      baseURL: normalizeBaseURL(config.baseURL),
    });
  }
  const preset = getPreset(presets, config.preset) || getPreset(presets, fallback.preset);
  if (!preset) {
    return fallback;
  }
  return extraFields.reduce((normalized, field) => {
    normalized[field] = preset[field];
    return normalized;
  }, {
    preset: preset.value,
    baseURL: normalizeBaseURL(preset.baseURL),
  });
}

export function joinExplorerURL(baseURL, suffix) {
  const normalized = normalizeBaseURL(baseURL);
  if (!normalized) return '';
  if (normalized.includes('#/')) {
    return `${normalized}${suffix}`;
  }
  return new URL(suffix, normalized).toString();
}

const RETRYABLE_STATUS_CODES = new Set([429, 503, 504]);
const FETCH_RETRY_COUNT = 3;

function parseRetryAfter(header) {
  const seconds = Number(header);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
}

function getRetryDelay(response, attempt) {
  const retryAfter = parseRetryAfter(response.headers.get('retry-after'));
  if (retryAfter !== undefined) {
    return retryAfter;
  }
  if (response.status === 429) {
    return 3000 * attempt;
  }
  return 1000 * attempt;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getFetch(fetchFn) {
  const resolved = fetchFn || globalThis.fetch?.bind(globalThis);
  if (typeof resolved !== 'function') {
    throw new TypeError('fetch is required');
  }
  return async (input, init) => {
    for (let attempt = 1; attempt <= FETCH_RETRY_COUNT; attempt++) {
      const response = await resolved(input, init);
      if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === FETCH_RETRY_COUNT) {
        return response;
      }
      await sleep(getRetryDelay(response, attempt));
    }
  };
}
