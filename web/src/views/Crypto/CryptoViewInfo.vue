<script>
import { cryptoSubtitleWithSymbol } from '../../lib/helpers.js';

import CsButton from '../../components/CsButton.vue';
import CsFormGroup from '../../components/CsForm/CsFormGroup.vue';
import CsFormTextareaReadonly from '../../components/CsForm/CsFormTextareaReadonly.vue';
import CsTokenInfo from '../../components/CsTokenInfo.vue';
import MainLayout from '../../layouts/MainLayout.vue';

export default {
  components: {
    MainLayout,
    CsButton,
    CsFormGroup,
    CsFormTextareaReadonly,
    CsTokenInfo,
  },
  data() {
    return {
      url: undefined,
      subtitleWithSymbol: cryptoSubtitleWithSymbol(this.$wallet),
    };
  },
  async mounted() {
    this.url = await this.$account.getTokenUrl(this.$wallet.crypto.platform, this.$wallet.crypto.address);
  },
};
</script>

<template>
  <MainLayout :title="$t('Token info')">
    <CsTokenInfo
      class="&__token-info"
      :crypto="$wallet.crypto"
      :platform="$wallet.platform"
      :title="$wallet.crypto.name"
      :subtitles="[subtitleWithSymbol, $t('{decimals} decimals', { decimals: $wallet.crypto.decimals })]"
    />
    <CsFormGroup>
      <CsFormTextareaReadonly
        :label="$t('Contract address')"
        :value="$wallet.crypto.address"
      />
      <CsButton
        v-if="url"
        type="primary-link"
        @click="$safeOpen(url)"
      >
        {{ $t('View in Block Explorer') }}
      </CsButton>
    </CsFormGroup>
  </MainLayout>
</template>

<style lang="scss">
  .#{ $filename } {
    &__token-info {
      flex-grow: 1;
    }
  }
</style>
