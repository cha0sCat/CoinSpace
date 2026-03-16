<script>
import CsButton from './CsButton.vue';
import CsButtonGroup from './CsButtonGroup.vue';
import CsFormInput from './CsForm/CsFormInput.vue';

import { PASSWORD_MIN_LENGTH } from '../lib/account/PasswordUnlock.js';

export default {
  components: {
    CsButton,
    CsButtonGroup,
    CsFormInput,
  },
  props: {
    mode: {
      type: String,
      default: 'setup', // deviceSeed, walletSeed
    },
    onSuccess: {
      type: Function,
      default: undefined,
    },
    onUsePin: {
      type: Function,
      default: undefined,
    },
  },
  data() {
    return {
      password: '',
      confirmPassword: '',
      passwordError: undefined,
      confirmPasswordError: undefined,
      isLoading: false,
    };
  },
  computed: {
    isSetup() {
      return this.mode === 'setup';
    },
    canUsePin() {
      return this.mode !== 'setup' && typeof this.onUsePin === 'function';
    },
  },
  watch: {
    password() {
      this.passwordError = undefined;
    },
    confirmPassword() {
      this.confirmPasswordError = undefined;
    },
  },
  methods: {
    reset() {
      this.password = '';
      this.confirmPassword = '';
      this.passwordError = undefined;
      this.confirmPasswordError = undefined;
      this.isLoading = false;
    },
    async submit() {
      if (this.isLoading) return;
      this.passwordError = undefined;
      this.confirmPasswordError = undefined;

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
      try {
        switch (this.mode) {
          case 'setup':
            return await this.onSuccess(this.password);
          case 'deviceSeed':
            try {
              return await this.onSuccess(await this.$account.getDeviceSeedFromPassword(this.password), this.password);
            } catch {
              throw { status: 401 };
            }
          case 'walletSeed':
            try {
              return await this.onSuccess(await this.$account.getWalletSeedFromPassword(this.password), this.password);
            } catch {
              throw { status: 401 };
            }
        }
      } catch (error) {
        this._errorHandler(error);
      } finally {
        this.isLoading = false;
      }
    },

    _errorHandler(error) {
      switch (error.status) {
        case 401:
          this.passwordError = this.$t('Wrong password');
          this.password = '';
          this.confirmPassword = '';
          break;
        default:
          this.passwordError = this.$account.unknownError();
          console.error(error);
      }
    },
  },
};
</script>

<template>
  <form
    class="&"
    @submit.prevent="submit"
  >
    <div class="&__fields">
      <CsFormInput
        v-model="password"
        :label="$t('Password')"
        :error="passwordError"
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
        @click="submit"
      >
        {{ $t('Continue') }}
      </CsButton>
      <CsButton
        v-if="canUsePin"
        type="primary-link"
        @click="onUsePin"
      >
        {{ $t('Use PIN') }}
      </CsButton>
    </CsButtonGroup>
  </form>
</template>

<style lang="scss">
  .#{ $filename } {
    display: flex;
    flex-direction: column;
    gap: $spacing-xl;

    &__fields {
      display: flex;
      flex-direction: column;
      gap: $spacing-md;
    }
  }
</style>
