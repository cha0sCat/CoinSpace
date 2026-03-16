<script>
import CsListItem from '../../../components/CsListItem.vue';
import CsListItems from '../../../components/CsListItems.vue';
import CsStep from '../../../components/CsStep.vue';
import CsSwitch from '../../../components/CsSwitch.vue';
import MainLayout from '../../../layouts/MainLayout.vue';

export default {
  components: {
    CsListItem,
    CsListItems,
    CsSwitch,
    MainLayout,
  },
  extends: CsStep,
  data() {
    return {
      isLoading: false,
      offlineMode: this.$isOfflineMode,
      features: {
        market: this.$isMarketEnabled,
        swap: this.$isSwapEnabled,
      },
    };
  },
  methods: {
    async toggleOfflineMode() {
      this.isLoading = true;
      try {
        await this.$account.setOfflineMode(!this.offlineMode);
        this.offlineMode = this.$account.isOfflineMode;
        this.features.market = this.$account.isMarketEnabled;
        this.features.swap = this.$account.isSwapEnabled;
      } finally {
        this.isLoading = false;
      }
    },
    async toggleFeature(feature) {
      if (this.offlineMode) return;
      this.isLoading = true;
      try {
        await this.$account.setServerFeatureEnabled(feature, !this.features[feature]);
        this.features.market = this.$account.isMarketEnabled;
        this.features.swap = this.$account.isSwapEnabled;
      } finally {
        this.isLoading = false;
      }
    },
  },
};
</script>

<template>
  <MainLayout :title="$t('Network')">
    <CsListItems :title="$t('Offline mode')">
      <CsListItem
        :title="$t('Offline mode')"
        :description="$t('Disable all features that require your server, including market data and swaps.')"
        :arrow="false"
      >
        <template #after>
          <CsSwitch
            :checked="offlineMode"
            :isLoading="isLoading"
            :aria-label="$t('Offline mode')"
            @click="toggleOfflineMode"
          />
        </template>
      </CsListItem>
    </CsListItems>

    <CsListItems :title="$t('Server features')">
      <CsListItem
        :title="$t('Market data')"
        :description="$t('Prices and charts provided by your server API.')"
        :arrow="false"
      >
        <template #after>
          <CsSwitch
            :checked="features.market"
            :isLoading="isLoading || offlineMode"
            :aria-label="$t('Market data')"
            @click="toggleFeature('market')"
          />
        </template>
      </CsListItem>
      <CsListItem
        :title="$t('Swap')"
        :description="$t('Third-party exchange aggregation through your server API.')"
        :arrow="false"
      >
        <template #after>
          <CsSwitch
            :checked="features.swap"
            :isLoading="isLoading || offlineMode"
            :aria-label="$t('Swap')"
            @click="toggleFeature('swap')"
          />
        </template>
      </CsListItem>
    </CsListItems>
  </MainLayout>
</template>
