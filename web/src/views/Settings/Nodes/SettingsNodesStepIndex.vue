<script>
import CsCryptoLogo from '../../../components/CsCryptoLogo.vue';
import CsListItem from '../../../components/CsListItem.vue';
import CsListItems from '../../../components/CsListItems.vue';
import CsStep from '../../../components/CsStep.vue';
import MainLayout from '../../../layouts/MainLayout.vue';
import { SUPPORTED_PLATFORMS } from '../../../lib/constants.js';
import {
  CHAIN_LABELS,
  getExplorerOptions,
  getNodeOptions,
} from '../../../lib/connections.js';

function resolveOptionName(options, config) {
  const option = options.find((item) => item.value === config.preset);
  if (config.preset === 'custom') {
    return config.baseURL || option?.name || '';
  }
  return option?.name || config.baseURL || '';
}

export default {
  components: {
    CsCryptoLogo,
    CsListItem,
    CsListItems,
    MainLayout,
  },
  extends: CsStep,
  computed: {
    chains() {
      return SUPPORTED_PLATFORMS.map((platform) => {
        const node = this.$account.getNode(platform);
        const explorer = this.$account.settings.getExplorer(platform);
        return {
          crypto: this.$account.cryptoDB.platform(platform),
          platform,
          name: CHAIN_LABELS[platform],
          description: [
            resolveOptionName(getNodeOptions(platform), node),
            resolveOptionName(getExplorerOptions(platform), explorer),
          ].filter(Boolean).join(' · '),
        };
      });
    },
  },
  methods: {
    openChain(platform) {
      this.next('chain', { platform });
    },
  },
};
</script>

<template>
  <MainLayout :title="$t('Nodes')">
    <CsListItems>
      <CsListItem
        v-for="chain in chains"
        :key="chain.platform"
        :title="chain.name"
        :description="chain.description"
        @click="openChain(chain.platform)"
      >
        <template #before>
          <CsCryptoLogo
            class="&__logo"
            :crypto="chain.crypto"
          />
        </template>
      </CsListItem>
    </CsListItems>
  </MainLayout>
</template>

<style lang="scss">
  .#{ $filename } {
    &__logo {
      width: $spacing-2xl;
      height: $spacing-2xl;
      flex-shrink: 0;
    }
  }
</style>
