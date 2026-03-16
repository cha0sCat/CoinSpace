<script>
import QRCode from 'qrcode-svg';

import * as BitcoinSymbols from '@coinspace/cs-bitcoin-wallet/symbols';

import CsButton from '../../../components/CsButton.vue';
import CsButtonGroup from '../../../components/CsButtonGroup.vue';
import CsFormTextareaReadonly from '../../../components/CsForm/CsFormTextareaReadonly.vue';
import CsStep from '../../../components/CsStep.vue';
import MainLayout from '../../../layouts/MainLayout.vue';

import ChevronLeftIcon from '../../../assets/svg/chevronLeft.svg';
import ChevronRightIcon from '../../../assets/svg/chevronRight.svg';
import CopyIcon from '../../../assets/svg/copy.svg';
import ShareIcon from '../../../assets/svg/share.svg';

import { cryptoSubtitle } from '../../../lib/helpers.js';
import { onShowOnHide } from '../../../lib/mixins.js';

export default {
  components: {
    MainLayout,
    CsButton,
    CsButtonGroup,
    CsFormTextareaReadonly,
    ChevronLeftIcon,
    ChevronRightIcon,
    CopyIcon,
    ShareIcon,
  },
  extends: CsStep,
  mixins: [onShowOnHide],
  data() {
    return {
      subtitle: cryptoSubtitle(this.$wallet),
      address: this.$wallet.address,
      isAddressTypesSupported: this.$wallet.isAddressTypesSupported,
      isAddressChangeSupported: this.$wallet.isAddressChangeSupported,
      addressType: this.$wallet.addressType,
      addressTypes: this.$wallet.addressTypes,
      isCopied: false,
    };
  },
  computed: {
    qr() {
      const qrcode = new QRCode({
        content: this.address,
        join: true,
        padding: 0,
        container: 'svg-viewbox',
      });
      return qrcode.svg();
    },
    addressTypeLabel() {
      if (this.addressTypes.length <= 1) return '';
      switch (this.addressType) {
        case BitcoinSymbols.ADDRESS_TYPE_P2PKH:
          return this.$t('Legacy');
        case BitcoinSymbols.ADDRESS_TYPE_P2SH:
          return this.$t('P2SH');
        case BitcoinSymbols.ADDRESS_TYPE_P2WPKH:
          return this.$t('Bech32');
        default:
          return '';
      }
    },
  },
  methods: {
    prevAddressType() {
      const i = this.addressTypes.indexOf(this.addressType);
      if (i === 0) return;
      this.$wallet.addressType = this.addressTypes[i - 1];
      this.addressType = this.$wallet.addressType;
      this.address = this.$wallet.address;
    },
    nextAddressType() {
      const i = this.addressTypes.indexOf(this.addressType);
      if (i === (this.addressTypes.length - 1)) return;
      this.$wallet.addressType = this.addressTypes[i + 1];
      this.addressType = this.$wallet.addressType;
      this.address = this.$wallet.address;
    },
    copy() {
      navigator.clipboard.writeText(this.address).then(() => {
        this.isCopied = true;
        setTimeout(() => {
          this.isCopied = false;
        }, 1000);
      }, () => {});
    },
    async share() {
      if (this.env.VITE_BUILD_TYPE === 'phonegap') {
        return window.plugins.socialsharing.shareWithOptions({
          message: this.address,
        });
      }
      try {
        if (navigator.share) {
          await navigator.share({
            title: this.$t('Wallet address'),
            text: this.address,
          });
        } else {
          const body = encodeURIComponent([
            this.address,
            '',
            `Sent from ${this.$account.appName}`,
            this.$account.shareUrl,
          ].filter(Boolean).join('\n'));
          this.$safeOpen(`mailto:?body=${body}`);
        }
      } catch (err) { /* empty */ }
    },
  },
};
</script>

<!-- eslint-disable vue/no-v-html -->
<template>
  <MainLayout
    :title="$t('Receive {symbol}', { symbol: $wallet.crypto.symbol })"
    :description="subtitle"
  >
    <div class="&__qr-wrapper">
      <CsButton
        v-if="isAddressTypesSupported"
        class="&__address-type-button"
        :class="{
          '&__address-type-button--disabled': addressTypes.indexOf(addressType) === 0,
        }"
        @click="prevAddressType"
      >
        <ChevronLeftIcon />
      </CsButton>
      <div
        class="&__qr"
        v-html="qr"
      />
      <CsButton
        v-if="isAddressTypesSupported"
        class="&__address-type-button"
        :class="{
          '&__address-type-button--disabled': addressTypes.indexOf(addressType) === (addressTypes.length - 1),
        }"
        @click="nextAddressType"
      >
        <ChevronRightIcon />
      </CsButton>
    </div>

    <div class="&__input-wrapper">
      <CsFormTextareaReadonly
        :value="address"
        :label="$t('Your wallet address') + (isAddressTypesSupported ? ` (${addressTypeLabel})` : '')"
        :info="(isAddressTypesSupported || isAddressChangeSupported) ? $t('Your wallet address') : false"
      >
        <template #info>
          <div v-if="isAddressChangeSupported">
            <!-- eslint-disable-next-line max-len -->
            {{ $t('Address will be changed after receiving funds. All previously used addresses remain valid and still can be used to receive funds multiple times. Please use a fresh address for each receiving transaction to enhance your privacy.') }}
          </div>
          <div v-if="isAddressTypesSupported">
            <!-- eslint-disable-next-line max-len -->
            {{ $t('Not all address types are fully compatible on all platforms, so it is important to use a compatible address.') }}
          </div>
        </template>
      </CsFormTextareaReadonly>
    </div>

    <CsButtonGroup
      class="&__actions"
      type="circle"
    >
      <CsButton
        type="circle"
        @click="copy"
      >
        <template #circle>
          <CopyIcon />
        </template>
        {{ isCopied ? $t('Copied!') : $t('Copy') }}
      </CsButton>
      <CsButton
        type="circle"
        @click="share"
      >
        <template #circle>
          <ShareIcon />
        </template>
        {{ $t('Share') }}
      </CsButton>
    </CsButtonGroup>
  </MainLayout>
</template>

<style lang="scss">
  .#{ $filename } {
    $self: &;

    &__qr-wrapper {
      display: flex;
      align-items: center;
      justify-content: center;
    }

    &__qr {
      width: 12rem;
      height: 12rem;
      flex-shrink: 0;
      padding: $spacing-md;
      border: 1px solid $gray;
      border-radius: 0.625rem;
    }

    &__address-type-button {
      width: 3.5rem;
      height: 3.5rem;

      &--disabled {
        opacity: 0.4;
        pointer-events: none;
      }

      svg {
        width: $spacing-xl;
        height: $spacing-xl;
        margin: 0 auto;
      }
    }

    &__input-wrapper {
      flex-grow: 1;
    }

    &__actions {
      position: relative;
      width: 100%;
      max-width: 25rem;
      align-self: center;
    }
  }
</style>
