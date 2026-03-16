<script>
import CsButton from './CsButton.vue';
import CsButtonGroup from './CsButtonGroup.vue';
import CsFormInput from './CsForm/CsFormInput.vue';
import CsLogoutConfirmModal from './CsLogoutConfirmModal.vue';

import { TYPES } from '../lib/account/Biometry.js';
import { onShowOnHide } from '../lib/mixins.js';
import {
  PASSCODE_TYPES,
  PASSWORD_MIN_LENGTH,
  PIN_LENGTH,
} from '../lib/account/PasscodeUnlock.js';

import FaceIdSolidIcon from '../assets/svg/faceIdSolid.svg';
import TouchIdSolidIcon from '../assets/svg/touchIdSolid.svg';

export default {
  components: {
    CsButton,
    CsButtonGroup,
    CsFormInput,
    CsLogoutConfirmModal,
    FaceIdSolidIcon,
    TouchIdSolidIcon,
  },
  mixins: [onShowOnHide],
  props: {
    mode: {
      type: String,
      default: 'setup', // deviceSeed, walletSeed
    },
    passcodeType: {
      type: String,
      default: PASSCODE_TYPES.PIN,
    },
    allowTypeSwitch: {
      type: Boolean,
      default: false,
    },
    logoutButton: {
      type: Boolean,
      default: false,
    },
    onSuccess: {
      type: Function,
      default: undefined,
    },
  },
  data() {
    const { type, isEnabled } = this.$account.biometry;
    return {
      currentPasscodeType: this.passcodeType || PASSCODE_TYPES.PIN,
      pinLength: PIN_LENGTH,
      pinValue: '',
      password: '',
      confirmPassword: '',
      passwordError: undefined,
      confirmPasswordError: undefined,
      error: undefined,
      isLoading: false,
      isWrong: false,
      logoutConfirmStep: 0,
      biometryIsEnabled: isEnabled && this.mode !== 'setup',
      webAuthnIsEnabled: this.$account.webAuthn.isEnabled && this.mode !== 'setup',
      biometryIcon: type === TYPES.FACE_ID ? 'FaceIdSolidIcon' : 'TouchIdSolidIcon',
    };
  },
  computed: {
    resolvedPasscodeType() {
      if (this.mode === 'setup') {
        return this.currentPasscodeType || PASSCODE_TYPES.PIN;
      }
      return this.$account.passcodeUnlock.type;
    },
    biometryLabel() {
      switch (this.$account.biometry.type) {
        case TYPES.FACE_ID:
          return this.$t('Face ID');
        case TYPES.TOUCH_ID:
          return this.$t('Touch ID');
        case TYPES.FINGERPRINT:
          return this.$t('Fingerprint');
        default:
          return this.$t('Biometrics');
      }
    },
    isPinType() {
      return this.resolvedPasscodeType === PASSCODE_TYPES.PIN;
    },
    isPasswordType() {
      return this.resolvedPasscodeType === PASSCODE_TYPES.PASSWORD;
    },
    isSetup() {
      return this.mode === 'setup';
    },
    showLogoutConfirm() {
      return this.logoutConfirmStep > 0;
    },
    canSwitchToPassword() {
      return this.isSetup
        && this.allowTypeSwitch
        && this.resolvedPasscodeType === PASSCODE_TYPES.PIN;
    },
    canSwitchToPin() {
      return this.isSetup
        && this.allowTypeSwitch
        && this.resolvedPasscodeType === PASSCODE_TYPES.PASSWORD;
    },
  },
  watch: {
    passcodeType(value) {
      this.currentPasscodeType = value || PASSCODE_TYPES.PIN;
      this.reset();
    },
    resolvedPasscodeType() {
      this.syncKeydownListener();
    },
    async pinValue(value) {
      if (this.isPinType && value.length === this.pinLength) {
        await this.$nextTick();
        await this.waitForPaint();
        await this.submitPin(value);
      }
    },
    password() {
      this.passwordError = undefined;
    },
    confirmPassword() {
      this.confirmPasswordError = undefined;
    },
  },
  onShow() {
    if (this.biometryIsEnabled) {
      this.biometry();
    }
    this.syncKeydownListener();
  },
  onHide() {
    window.removeEventListener('keydown', this.keydown);
  },
  methods: {
    syncKeydownListener() {
      window.removeEventListener('keydown', this.keydown);
      if (this.isPinType) {
        window.addEventListener('keydown', this.keydown);
      }
    },
    waitForPaint() {
      return new Promise((resolve) => {
        if (typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => resolve());
          });
          return;
        }
        setTimeout(resolve, 0);
      });
    },
    reset() {
      this.pinValue = '';
      this.password = '';
      this.confirmPassword = '';
      this.passwordError = undefined;
      this.confirmPasswordError = undefined;
      this.error = undefined;
      this.isLoading = false;
      this.isWrong = false;
    },
    enter(number) {
      if (this.isLoading || !this.isPinType) return;
      if (this.pinValue.length === this.pinLength) return;
      this.pinValue += number;
      this.error = undefined;
      window.taptic?.tap();
    },
    backspace() {
      if (this.isLoading || !this.isPinType) return;
      this.pinValue = this.pinValue.slice(0, -1);
      window.taptic?.tap();
    },
    keydown({ key }) {
      if (!this.isPinType) return;
      if (/\d/.test(key)) {
        this.enter(key);
      }
      if (key === 'Backspace') {
        this.backspace();
      }
    },
    logout() {
      if (!this.logoutButton) return;
      this.logoutConfirmStep = 1;
    },
    closeLogoutConfirm() {
      this.logoutConfirmStep = 0;
    },
    confirmLogout() {
      this.$account.logout();
      this.$router.replace({ name: 'auth' });
    },
    usePassword() {
      this.currentPasscodeType = PASSCODE_TYPES.PASSWORD;
      this.reset();
    },
    usePin() {
      this.currentPasscodeType = PASSCODE_TYPES.PIN;
      this.reset();
    },
    async submitPin(pin) {
      this.isLoading = true;
      await this.$nextTick();
      await this.waitForPaint();
      try {
        switch (this.mode) {
          case 'setup':
            return await this.onSuccess(pin, this.resolvedPasscodeType);
          case 'deviceSeed':
            return await this.onSuccess(await this.unlockDeviceSeed(pin), pin);
          case 'walletSeed':
            return await this.onSuccess(await this.unlockWalletSeed(pin), pin);
        }
      } catch (err) {
        this._handlePinError(err);
      } finally {
        this.isLoading = false;
      }
    },
    async submitPassword() {
      if (this.isLoading) return;
      this.passwordError = undefined;
      this.confirmPasswordError = undefined;
      this.error = undefined;

      if (!this.password) {
        this.passwordError = this.$t('Password should not be empty');
        return;
      }
      if (this.password.length < PASSWORD_MIN_LENGTH) {
        this.passwordError = this.$t('Password must be at least 8 characters.');
        return;
      }
      if (this.isSetup && this.password !== this.confirmPassword) {
        this.confirmPasswordError = this.$t('Passwords do not match');
        return;
      }

      this.isLoading = true;
      await this.$nextTick();
      await this.waitForPaint();
      try {
        switch (this.mode) {
          case 'setup':
            return await this.onSuccess(this.password, this.resolvedPasscodeType);
          case 'deviceSeed':
            return await this.onSuccess(await this.unlockDeviceSeed(this.password), this.password);
          case 'walletSeed':
            return await this.onSuccess(await this.unlockWalletSeed(this.password), this.password);
        }
      } catch (error) {
        this._handlePasswordError(error);
      } finally {
        this.isLoading = false;
      }
    },
    async unlockDeviceSeed(passcode) {
      try {
        return await this.$account.getDeviceSeedFromPasscode(passcode);
      } catch {
        throw { status: 401 };
      }
    },
    async unlockWalletSeed(passcode) {
      try {
        return await this.$account.getWalletSeedFromPasscode(passcode);
      } catch {
        throw { status: 401 };
      }
    },
    async biometry() {
      if (this.isLoading) return;
      this.isLoading = true;
      this.error = undefined;
      this.passwordError = undefined;
      try {
        if (this.env.VITE_BUILD_TYPE === 'phonegap') {
          const secret = await this.$account.biometry.phonegap();
          if (!secret) return;
          const deviceSeed = this.$account.getDeviceSeedFromBiometrySecret(secret);
          switch (this.mode) {
            case 'deviceSeed':
              return await this.onSuccess(deviceSeed);
            case 'walletSeed':
              return await this.onSuccess(this.$account.getWalletSeedFromDeviceSeed(deviceSeed));
          }
        }
      } catch (err) {
        this._handleGenericError(err);
      } finally {
        this.isLoading = false;
      }
    },
    async webAuthn() {
      if (this.isLoading) return;
      this.isLoading = true;
      this.error = undefined;
      this.passwordError = undefined;
      try {
        const deviceSeed = await this.$account.webAuthn.unlock();
        if (!deviceSeed) return;
        switch (this.mode) {
          case 'deviceSeed':
            return await this.onSuccess(deviceSeed);
          case 'walletSeed':
            return await this.onSuccess(this.$account.getWalletSeedFromDeviceSeed(deviceSeed));
        }
      } catch (err) {
        this._handleGenericError(err);
      } finally {
        this.isLoading = false;
      }
    },
    _handlePinError(error) {
      switch (error.status) {
        case 404:
        case 410:
          return this.logout();
        case 401:
          this.isWrong = true;
          this.pinValue = '';
          setTimeout(() => {
            this.isWrong = false;
          }, 700);
          window.taptic?.error();
          break;
        default:
          this._handleGenericError(error);
      }
    },
    _handlePasswordError(error) {
      switch (error.status) {
        case 404:
        case 410:
          return this.logout();
        case 401:
          this.passwordError = this.$t('Wrong password');
          this.password = '';
          this.confirmPassword = '';
          break;
        default:
          this._handleGenericError(error);
      }
    },
    _handleGenericError(error) {
      this.error = this.$account.unknownError();
      this.pinValue = '';
      this.password = '';
      this.confirmPassword = '';
      console.error(error);
    },
  },
};
</script>

<template>
  <div
    v-if="isPinType"
    class="&__pin"
  >
    <div
      class="&__dots"
      :class="{
        '&__dots--loading': isLoading,
        '&__dots--wrong': isWrong
      }"
    >
      <span
        v-if="error && !isLoading"
        class="&__error"
      >
        {{ error }}
      </span>
      <template v-else>
        <div
          v-for="index in pinLength"
          :key="index"
          class="&__dot"
          :class="{ '&__dot--active': pinValue.length >= index }"
        />
      </template>
    </div>
    <div
      v-if="webAuthnIsEnabled || canSwitchToPassword"
      class="&__methods"
    >
      <CsButton
        v-if="canSwitchToPassword"
        type="primary-link"
        @click="usePassword"
      >
        {{ $t('Use Password') }}
      </CsButton>
      <CsButton
        v-if="webAuthnIsEnabled"
        type="primary-link"
        @click="webAuthn"
      >
        {{ $t('Use Passkey') }}
      </CsButton>
    </div>
    <div class="&__keyboard">
      <div class="&__row">
        <CsButton
          v-for="number in [1, 2, 3]"
          :key="number"
          class="&__key"
          type="secondary"
          @click="enter(number)"
        >
          {{ number }}
        </CsButton>
      </div>
      <div class="&__row">
        <CsButton
          v-for="number in [4, 5, 6]"
          :key="number"
          type="secondary"
          class="&__key"
          @click="enter(number)"
        >
          {{ number }}
        </CsButton>
      </div>
      <div class="&__row">
        <CsButton
          v-for="number in [7, 8, 9]"
          :key="number"
          type="secondary"
          class="&__key"
          @click="enter(number)"
        >
          {{ number }}
        </CsButton>
      </div>
      <div class="&__row">
        <CsButton
          v-if="logoutButton"
          class="&__key &__key--named"
          @click="logout"
        >
          {{ $t('Log out') }}
        </CsButton>
        <div
          v-else
          class="&__key &__key--disabled"
        />
        <CsButton
          class="&__key"
          type="secondary"
          @click="enter(0)"
        >
          0
        </CsButton>
        <CsButton
          v-if="pinValue.length"
          class="&__key &__key--named"
          @click="backspace"
        >
          {{ $t('Delete') }}
        </CsButton>
        <CsButton
          v-else-if="biometryIsEnabled"
          class="&__key"
          @click="biometry"
        >
          <component
            :is="biometryIcon"
            class="&__biometry"
          />
        </CsButton>
        <div
          v-else
          class="&__key &__key--disabled"
        />
      </div>
    </div>
  </div>
  <form
    v-else
    class="&__password"
    @submit.prevent="submitPassword"
  >
    <div class="&__fields">
      <CsFormInput
        v-model="password"
        :label="$t('Password')"
        :error="passwordError || error"
        type="password"
        :trim="false"
      />
      <CsFormInput
        v-if="isSetup"
        v-model="confirmPassword"
        :label="$t('Confirm password')"
        :error="confirmPasswordError"
        type="password"
        :trim="false"
      />
    </div>
    <CsButtonGroup>
      <CsButton
        type="primary"
        :isLoading="isLoading"
        @click="submitPassword"
      >
        {{ $t('Continue') }}
      </CsButton>
      <CsButton
        v-if="canSwitchToPin"
        type="primary-link"
        @click="usePin"
      >
        {{ $t('Use PIN') }}
      </CsButton>
      <CsButton
        v-if="biometryIsEnabled"
        type="primary-link"
        @click="biometry"
      >
        {{ biometryLabel }}
      </CsButton>
      <CsButton
        v-if="webAuthnIsEnabled"
        type="primary-link"
        @click="webAuthn"
      >
        {{ $t('Use Passkey') }}
      </CsButton>
      <CsButton
        v-if="logoutButton"
        type="primary-link"
        @click="logout"
      >
        {{ $t('Log out') }}
      </CsButton>
    </CsButtonGroup>
  </form>
  <CsLogoutConfirmModal
    :show="showLogoutConfirm"
    @close="closeLogoutConfirm"
    @confirm="confirmLogout"
  />
</template>

<style lang="scss">
  .#{ $filename } {
    $self: &;

    &__pin,
    &__password {
      display: flex;
      flex-direction: column;
      gap: $spacing-xl;
    }

    &__dots {
      display: flex;
      flex-grow: 1;
      align-items: center;
      justify-content: center;
      gap: $spacing-lg;

      &--wrong {
        animation: shake-x 0.7s;
      }

      &--loading {
        #{ $self }__dot {
          background-color: $primary-brand;
        }
        #{ $self }__dot:nth-child(1) {
          animation: pulse-4 0.6s ease-in-out alternate infinite;
        }
        #{ $self }__dot:nth-child(2) {
          animation: pulse-4 0.6s ease-in-out alternate 0.2s infinite;
        }
        #{ $self }__dot:nth-child(3) {
          animation: pulse-4 0.6s ease-in-out alternate 0.4s infinite;
        }
        #{ $self }__dot:nth-child(4) {
          animation: pulse-4 0.6s ease-in-out alternate 0.6s infinite;
        }
        #{ $self }__dot:nth-child(5) {
          animation: pulse-4 0.6s ease-in-out alternate 0.8s infinite;
        }
        #{ $self }__dot:nth-child(6) {
          animation: pulse-4 0.6s ease-in-out alternate 1s infinite;
        }
      }
    }

    &__dot {
      width: $spacing-md;
      height: $spacing-md;
      border-radius: 50%;
      background-color: $gray;

      &--active {
        animation: scale-dot 0.2s;
        background-color: $primary-brand;
        opacity: 1;
      }
    }

    &__keyboard {
      display: flex;
      flex-direction: column;
      gap: $spacing-sm;
    }

    &__methods {
      display: flex;
      justify-content: center;
      gap: $spacing-md;
      margin-bottom: $spacing-sm;
    }

    &__row {
      display: flex;
      justify-content: center;
      gap: $spacing-lg;
    }

    &__key {
      @include text-xl;
      width: $spacing-6xl;
      height: $spacing-6xl;
      border-radius: 50%;
      font-weight: $font-weight-regular;

      &--disabled {
        background-color: transparent;
        pointer-events: none;
      }

      &--named {
        @include text-sm;
      }
    }

    &__biometry {
      height: $spacing-2xl;
      margin: 0 auto;
    }

    &__fields {
      display: flex;
      flex-direction: column;
      gap: $spacing-md;
    }

    &__error {
      @include text-md;
    }
  }
</style>
