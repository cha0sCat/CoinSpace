<script>
import AuthStepLayout from '../../layouts/AuthStepLayout.vue';
import CsButton from '../../components/CsButton.vue';
import CsButtonGroup from '../../components/CsButtonGroup.vue';
import CsStep from '../../components/CsStep.vue';

import FaceIdIcon from '../../assets/svg/faceId.svg';
import TouchIdIcon from '../../assets/svg/touchId.svg';

import { TYPES } from '../../lib/account/Biometry.js';
import { redirectToApp } from '../../lib/mixins.js';

export default {
  components: {
    CsButton,
    CsButtonGroup,
    AuthStepLayout,
    TouchIdIcon,
    FaceIdIcon,
  },
  extends: CsStep,
  mixins: [redirectToApp],
  data() {
    const { $t } = this;
    return {
      isLoading: false,
      title: $t('Unlock methods'),
    };
  },
  computed: {
    biometryConfig() {
      const { $t } = this;
      switch (this.$account.biometry.type) {
        case TYPES.BIOMETRICS:
          return {
            title: $t('Biometrics'),
            text: $t('Use Biometrics instead of PIN.'),
            buttonLabel: `${$t('Enable')} ${$t('Biometrics')}`,
            icon: 'TouchIdIcon',
          };
        case TYPES.FINGERPRINT:
          return {
            title: $t('Fingerprint'),
            text: $t('Use Fingerprint instead of PIN.'),
            buttonLabel: `${$t('Enable')} ${$t('Fingerprint')}`,
            icon: 'TouchIdIcon',
          };
        case TYPES.TOUCH_ID:
          return {
            title: 'Touch ID',
            text: $t('Use Touch ID instead of PIN.'),
            buttonLabel: `${$t('Enable')} Touch ID`,
            icon: 'TouchIdIcon',
          };
        case TYPES.FACE_ID:
          return {
            title: 'Face ID',
            text: $t('Use Face ID instead of PIN.'),
            buttonLabel: `${$t('Enable')} Face ID`,
            icon: 'FaceIdIcon',
          };
        default:
          return undefined;
      }
    },
    hasBiometry() {
      return this.$account.biometry.isAvailable;
    },
    hasWebAuthn() {
      return this.$account.webAuthn.isAvailable;
    },
    description() {
      if (this.hasBiometry && this.hasWebAuthn) {
        return this.$t('Enable one or more quick unlock methods.');
      }
      if (this.hasBiometry) {
        return this.biometryConfig?.text;
      }
      if (this.hasWebAuthn) {
        return this.$t('Use Passkey instead of PIN.');
      }
      return '';
    },
    icon() {
      if (this.hasBiometry && !this.hasWebAuthn) {
        return this.biometryConfig?.icon;
      }
      return undefined;
    },
    primaryButtonLabel() {
      if (this.hasBiometry && !this.hasWebAuthn) {
        return this.biometryConfig?.buttonLabel;
      }
      if (this.hasWebAuthn && !this.hasBiometry) {
        return this.$t('Enable Passkey');
      }
      return undefined;
    },
  },
  methods: {
    async setupBiometry() {
      this.isLoading = true;
      const result = await this.$account.biometry.enable(this.$account.getUnlockedDeviceSeed(), this.storage.seed);
      this.isLoading = false;
      if (!result) return;
      this.done();
    },
    async setupWebAuthn() {
      this.isLoading = true;
      const result = await this.$account.webAuthn.enable(this.$account.getUnlockedDeviceSeed());
      this.isLoading = false;
      if (!result) return;
      this.done();
    },
    done() {
      if (this.$account.cryptosToSelect) {
        this.next('selectCryptos');
      } else {
        this.redirectToApp();
      }
    },
  },
};
</script>

<template>
  <AuthStepLayout
    :title="title"
    @back="done"
  >
    <div
      v-if="icon"
      class="&__icon-wrapper"
    >
      <component
        :is="icon"
        class="&__icon"
      />
    </div>
    <div
      v-if="description"
      class="&__text"
    >
      {{ description }}
    </div>
    <CsButtonGroup>
      <CsButton
        v-if="primaryButtonLabel"
        type="primary"
        :isLoading="isLoading"
        @click="hasBiometry && !hasWebAuthn ? setupBiometry() : setupWebAuthn()"
      >
        {{ primaryButtonLabel }}
      </CsButton>
      <CsButton
        v-if="hasBiometry && hasWebAuthn"
        type="primary"
        :isLoading="isLoading"
        @click="setupBiometry"
      >
        {{ biometryConfig.buttonLabel }}
      </CsButton>
      <CsButton
        v-if="hasBiometry && hasWebAuthn"
        type="secondary"
        :isLoading="isLoading"
        @click="setupWebAuthn"
      >
        {{ $t('Enable Passkey') }}
      </CsButton>
      <CsButton
        type="primary-link"
        @click="done"
      >
        {{ $t('Skip') }}
      </CsButton>
    </CsButtonGroup>
  </AuthStepLayout>
</template>

<style lang="scss">
  .#{ $filename } {
    &__icon-wrapper {
      display: flex;
      flex-grow: 1;
      justify-content: center;
    }

    &__icon {
      width: $spacing-8xl;
    }

    &__text {
      @include text-md;
    }
  }
</style>
