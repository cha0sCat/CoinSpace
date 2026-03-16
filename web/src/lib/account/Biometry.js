import { hex } from '@scure/base';
import i18n from '../i18n/i18n.js';

export const TYPES = {
  BIOMETRICS: Symbol('BIOMETRICS'),
  FINGERPRINT: Symbol('FINGERPRINT'),
  TOUCH_ID: Symbol('TOUCH_ID'),
  FACE_ID: Symbol('FACE_ID'),
};

export default class Biometry {
  #clientStorage;
  #isAvailable;
  #type;

  get isAvailable() {
    return this.#isAvailable;
  }

  get isEnabled() {
    if (!this.#isAvailable) return false;
    return this.#clientStorage.isBiometryEnabled();
  }

  get type() {
    return this.#type;
  }

  constructor({ clientStorage }) {
    if (!clientStorage) {
      throw new TypeError('clientStorage is required');
    }
    this.#clientStorage = clientStorage;
  }

  async init() {
    let isAvailable = false;
    let type;

    try {
      if (import.meta.env.VITE_BUILD_TYPE === 'phonegap') {
        type = await new Promise((resolve) => {
          window.Fingerprint.isAvailable(
            (result) => resolve(result),
            () => resolve(false),
            { requireStrongBiometrics: true }
          );
        });
        isAvailable = !!type;
      } else {
        isAvailable = false;
      }
    } catch (err) {
      isAvailable = false;
    }

    if (isAvailable) {
      if (import.meta.env.VITE_BUILD_TYPE === 'phonegap') {
        if (type === 'face') {
          type = TYPES.FACE_ID;
        } else if (type === 'finger') {
          type = import.meta.env.VITE_PLATFORM === 'ios' ? TYPES.TOUCH_ID : TYPES.FINGERPRINT;
        } else if (type === 'biometric') {
          type = TYPES.BIOMETRICS;
        }
      } else {
        type = TYPES.BIOMETRICS;
      }
    }

    this.#isAvailable = isAvailable;
    this.#type = type;
  }

  async enable(secret, seed) {
    void seed;
    try {
      if (import.meta.env.VITE_BUILD_TYPE !== 'phonegap') return false;
      if (secret instanceof Uint8Array) {
        secret = hex.encode(secret);
      }
      await new Promise((resolve, reject) => {
        window.Fingerprint.registerBiometricSecret({
          description: import.meta.env.VITE_PLATFORM === 'ios' ? i18n.global.t('Scan your fingerprint please') : '',
          secret,
          invalidateOnEnrollment: true,
          fallbackButtonTitle: i18n.global.t('Cancel'),
          disableBackup: true,
        }, resolve, reject);
      });
      this.#clientStorage.setBiometryEnabled(true);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  async disable(seed) {
    void seed;
    try {
      this.#clientStorage.setBiometryEnabled(false);
      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  }

  async phonegap() {
    try {
      const secret = await new Promise((resolve, reject) => {
        window.Fingerprint.loadBiometricSecret({
          description: import.meta.env.VITE_PLATFORM === 'ios' ? i18n.global.t('Scan your fingerprint please') : '',
          fallbackButtonTitle: i18n.global.t('Cancel'),
          disableBackup: true,
        }, (secret) => resolve(secret), () => reject());
      });
      return secret;
    } catch (err) { /* empty */ }
  }
}
