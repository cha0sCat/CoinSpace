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
      isWebAuthnEnabled: this.$account.webAuthn.isEnabled,
      isHighSecurityEnabled: this.$account.settings.get('1faWallet'),
      isLoading: false,
    };
  },
  computed: {
    labels() {
      const { $t } = this;
      switch (this.$account.biometry.type) {
        case TYPES.BIOMETRICS:
          return {
            title: $t('PIN & Biometrics'),
            biometry: $t('Biometrics'),
            description: $t('Use Biometrics instead of PIN.'),
          };
        case TYPES.FINGERPRINT:
          return {
            title: $t('PIN & Fingerprint'),
            biometry: $t('Fingerprint'),
            description: $t('Use Fingerprint instead of PIN.'),
          };
        case TYPES.TOUCH_ID:
          return {
            title: $t('PIN & Touch ID'),
            biometry: $t('Touch ID'),
            description: $t('Use Touch ID instead of PIN.'),
          };
        case TYPES.FACE_ID:
          return {
            title: $t('PIN & Face ID'),
            biometry: $t('Face ID'),
            description: $t('Use Face ID instead of PIN.'),
          };
        default:
          return {
            title: $t('PIN'),
          };
      }
    },
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
        this.next('pin', {
          mode: 'deviceSeed',
          layout: 'MainLayout',
          success: async (deviceSeed) => {
            await this.$account.biometry.enable(deviceSeed);
            this.isBiometryEnabled = this.$account.biometry.isEnabled;
            this.back();
          },
        });
      }
      this.isLoading = false;
    },
    async toggleWebAuthn() {
      this.isLoading = true;
      if (this.isWebAuthnEnabled) {
        await this.$account.webAuthn.disable();
        this.isWebAuthnEnabled = this.$account.webAuthn.isEnabled;
        this.isLoading = false;
        return;
      }
      this.next('pin', {
        mode: 'deviceSeed',
        layout: 'MainLayout',
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
    :title="labels.title"
  >
    <CsListItems>
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
        :description="$t('Use Passkey instead of PIN.')"
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
