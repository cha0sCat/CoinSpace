import { fiatToAtom, multiplyAtom } from './utils.js';

/**
 * minFeeAtom = minFeeUSD / price * (10 ** decimals)
 * maxFeeAtom = maxFeeUSD / price * (10 ** decimals)
 * feeAtom = value * feePercent
 *
 * @param {bigint} value - crypto atoms
 * @param {object} config
 * @param {boolean} config.disabled - is csfee disabled
 * @param {number} config.fee - percent
 * @param {number} config.minFee - minimum fee in USD
 * @param {number} config.maxFee - maximum fee in USD
 * @param {bigint} config.feeAddition - constant addition to fee in atoms
 * @param {number} config.price - price of unit in USD
 * @param {number} config.decimals - decimal places of unit value
 * @param {bigint} config.dustThreshold - meaningless amount
 * @returns {bigint}
 */
export function calculateCsFee(value, config = {}) {
  if (config.disabled === true) {
    return 0n;
  }
  if (typeof value !== 'bigint') {
    throw new TypeError('value must be a bigint');
  }
  if (typeof config.dustThreshold !== 'bigint') {
    throw new TypeError('config.dustThreshold must be a bigint');
  }
  if (typeof config.minFee !== 'number') {
    throw new TypeError('config.minFee must be a number');
  }
  if (typeof config.maxFee !== 'number') {
    throw new TypeError('config.maxFee must be a number');
  }
  if (typeof config.decimals !== 'number') {
    throw new TypeError('config.decimals must be a number');
  }
  if (typeof config.fee !== 'number') {
    throw new TypeError('config.fee must be a number');
  }
  const minFeeAtom = fiatToAtom(config.minFee, config.price, config.decimals);
  const maxFeeAtom = fiatToAtom(config.maxFee, config.price, config.decimals);

  let feeAtom = multiplyAtom(value, config.fee);

  if (feeAtom > maxFeeAtom) {
    feeAtom = maxFeeAtom;
  } else if (feeAtom < minFeeAtom) {
    feeAtom = minFeeAtom;
  }
  if (config.feeAddition) {
    feeAtom += config.feeAddition;
  }
  // allow to send amount equals to dust
  if (feeAtom < config.dustThreshold) {
    return config.dustThreshold;
  }
  return feeAtom;
}

/**
 * value = value + csFee
 * calculated fee maybe 1 atom bigger then actual fee
 *
 * @param {bigint} value - crypto atoms
 * @param {object} config
 * @param {boolean} config.disabled - is csfee disabled
 * @param {number} config.fee - percent
 * @param {number} config.minFee - minimum fee in USD
 * @param {number} config.maxFee - maximum fee in USD
 * @param {bigint} config.feeAddition - constant addition to fee in atoms
 * @param {number} config.price - price of unit in USD
 * @param {number} config.decimals - decimal places of unit value
 * @param {bigint} config.dustThreshold - meaningless amount
 * @returns {bigint}
 */
export function calculateCsFeeForMaxAmount(value, config = {}) {
  if (config.disabled === true) {
    return 0n;
  }
  if (typeof value !== 'bigint') {
    throw new TypeError('value must be a bigint');
  }
  if (typeof config.dustThreshold !== 'bigint') {
    throw new TypeError('config.dustThreshold must be a bigint');
  }
  if (typeof config.minFee !== 'number') {
    throw new TypeError('config.minFee must be a number');
  }
  if (typeof config.maxFee !== 'number') {
    throw new TypeError('config.maxFee must be a number');
  }
  if (typeof config.decimals !== 'number') {
    throw new TypeError('config.decimals must be a number');
  }
  if (typeof config.fee !== 'number') {
    throw new TypeError('config.fee must be a number');
  }
  const minFeeAtom = fiatToAtom(config.minFee, config.price, config.decimals);
  const maxFeeAtom = fiatToAtom(config.maxFee, config.price, config.decimals);

  const total = value - (config.feeAddition || 0n);
  // so that the reverse calculation is guaranteed equal or 1 more
  // then add 1 atom here to the quantity
  let feeAtom = multiplyAtom(total + 1n, parseFloat(config.fee) / (1 + parseFloat(config.fee)));

  if (feeAtom > maxFeeAtom) {
    feeAtom = maxFeeAtom;
  } else if (feeAtom < minFeeAtom) {
    feeAtom = minFeeAtom;
  }
  if (config.feeAddition) {
    feeAtom += config.feeAddition;
  }
  // allow to send amount equals to dust
  if (feeAtom < config.dustThreshold) {
    return config.dustThreshold;
  }
  return feeAtom;
}
