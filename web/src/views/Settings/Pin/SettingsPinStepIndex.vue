<script>
import CsListItem from '../../../components/CsListItem.vue';
import CsListItems from '../../../components/CsListItems.vue';
import CsStep from '../../../components/CsStep.vue';
import CsSwitch from '../../../components/CsSwitch.vue';
import MainLayout from '../../../layouts/MainLayout.vue';

import { TYPES } from '../../../lib/account/Biometry.js';
import { walletSeed } from '../../../lib/mixins.js';

export default {
  components: {
    MainLayout,
    CsListItem,
    CsListItems,
    CsSwitch,
  },
  extends: CsStep,
  mixins: [walletSeed],
  data() {
    return {
      isBiometryEnabled: this.$account.biometry.isEnabled,
      isPasswordSelected: this.$account.passcodeUnlock.type === 'password',
      isWebAuthnEnabled: this.$account.webAuthn.isEnabled,
      isHighSecurityEnabled: this.$account.settings.get('1faWallet'),
      isLoading: false,
    };
  },
  computed: {
    passcodeDescription() {
      return this.isPasswordSelected ? this.$t('Current: Password') : this.$t('Current: PIN');
    },
    labels() {
      const { $t } = this;
      switch (this.$account.biometry.type) {
        case TYPES.BIOMETRICS:
          return {
            biometry: $t('Biometrics'),
            description: $t('Use Biometrics for local unlock.'),
          };
        case TYPES.FINGERPRINT:
          return {
            biometry: $t('Fingerprint'),
            description: $t('Use Fingerprint for local unlock.'),
          };
        case TYPES.TOUCH_ID:
          return {
            biometry: $t('Touch ID'),
            description: $t('Use Touch ID for local unlock.'),
          };
        case TYPES.FACE_ID:
          return {
            biometry: $t('Face ID'),
            description: $t('Use Face ID for local unlock.'),
          };
        default:
          return {
            biometry: $t('Biometrics'),
          };
      }
    },
  },
  deactivated() {
    this.isLoading = false;
  },
  methods: {
    async toggleBiometry() {
      this.isLoading = true;
      return this.toggleBiometryPhongap();
    },
    async toggleBiometryPhongap() {
      if (this.isBiometryEnabled) {
        await this.$account.biometry.disable();
        this.isBiometryEnabled = this.$account.biometry.isEnabled;
      } else {
        this.next('unlock', {
          mode: 'deviceSeed',
          layout: 'MainLayout',
          title: this.$t('Unlock'),
          success: async (deviceSeed) => {
            await this.$account.biometry.enable(deviceSeed);
            this.isBiometryEnabled = this.$account.biometry.isEnabled;
            this.back();
          },
        });
      }
      this.isLoading = false;
    },
    changePasscode() {
      this.next('unlock', {
        mode: 'deviceSeed',
        layout: 'MainLayout',
        title: this.$t('Unlock'),
        success: async (deviceSeed) => {
          this.next('unlock', {
            mode: 'setup',
            passcodeType: this.$account.passcodeUnlock.type,
            allowTypeSwitch: true,
            layout: 'MainLayout',
            title: this.$t('Change Passcode'),
            success: async (passcode, passcodeType) => {
              const result = await this.$account.passcodeUnlock.enable(
                deviceSeed,
                passcode,
                passcodeType
              );
              if (!result) return;
              this.isPasswordSelected = this.$account.passcodeUnlock.type === 'password';
              this.back({ passcodeChanged: true });
            },
          });
        },
      });
    },
    async toggleWebAuthn() {
      this.isLoading = true;
      if (this.isWebAuthnEnabled) {
        await this.$account.webAuthn.disable();
        this.isWebAuthnEnabled = this.$account.webAuthn.isEnabled;
        this.isLoading = false;
        return;
      }
      this.next('unlock', {
        mode: 'deviceSeed',
        layout: 'MainLayout',
        title: this.$t('Unlock'),
        success: async (deviceSeed) => {
          await this.$account.webAuthn.enable(deviceSeed);
          this.isWebAuthnEnabled = this.$account.webAuthn.isEnabled;
          this.isLoading = false;
          this.back();
        },
      });
    },
    async toggleHighSecurity() {
      this.isLoading = true;
      await this.walletSeed(async (walletSeed) => {
        await this.$account.settings.set('1faWallet', !this.isHighSecurityEnabled, walletSeed);
        this.isHighSecurityEnabled = this.$account.settings.get('1faWallet');
      }, { keepStep: true });
      this.isLoading = false;
    },
  },
};
</script>

<template>
  <MainLayout
    :title="$t('Unlock methods')"
  >
    <div
      v-if="args?.passcodeChanged"
      class="&__success"
    >
      {{ $t('Passcode updated') }}
    </div>
    <CsListItems>
      <CsListItem
        :title="$t('Change Passcode')"
        :description="passcodeDescription"
        :disabled="isLoading"
        @click="changePasscode"
      />
      <CsListItem
        v-if="$account.biometry.isAvailable"
        :title="labels.biometry"
        :description="labels.description"
        :arrow="false"
      >
        <template #after>
          <CsSwitch
            :checked="isBiometryEnabled"
            :isLoading="isLoading"
            :aria-label="labels.biometry"
            @click="toggleBiometry"
          />
        </template>
      </CsListItem>
      <CsListItem
        v-if="$account.webAuthn.isAvailable"
        :title="$t('Passkey')"
        :description="$t('Use Passkey for local unlock.')"
        :arrow="false"
      >
        <template #after>
          <CsSwitch
            :checked="isWebAuthnEnabled"
            :isLoading="isLoading"
            :aria-label="$t('Passkey')"
            @click="toggleWebAuthn"
          />
        </template>
      </CsListItem>
      <CsListItem
        :title="$t('High security')"
        :description="$t('Send coins, export private keys, remove account, security settings.')"
        :arrow="false"
      >
        <template #after>
          <CsSwitch
            :checked="isHighSecurityEnabled"
            :isLoading="isLoading"
            :aria-label="labels.biometry"
            @click="toggleHighSecurity"
          />
        </template>
      </CsListItem>
    </CsListItems>
  </MainLayout>
</template>

<style lang="scss">
  .#{ $filename } {
    &__success {
      @include text-sm;
      padding: 0 max($spacing-xl, env(safe-area-inset-right)) $spacing-md max($spacing-xl, env(safe-area-inset-left));
      color: $primary-brand;

      @include breakpoint(lg) {
        padding-right: 0;
        padding-left: 0;
      }
    }
  }
</style>
