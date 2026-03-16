<script>
import CsButton from '../../../components/CsButton.vue';
import CsFormGroup from '../../../components/CsForm/CsFormGroup.vue';
import CsFormInput from '../../../components/CsForm/CsFormInput.vue';
import CsFormSelect from '../../../components/CsForm/CsFormSelect.vue';
import CsStep from '../../../components/CsStep.vue';
import MainLayout from '../../../layouts/MainLayout.vue';
import {
  CHAIN_LABELS,
  getDefaultExplorer,
  getDefaultNode,
  getExplorerOptions,
  getNodeOptions,
} from '../../../lib/connections.js';

function buildChain(platform) {
  const defaultNode = getDefaultNode(platform);
  return {
    platform,
    name: CHAIN_LABELS[platform],
    nodeOptions: getNodeOptions(platform),
    nodePlaceholder: defaultNode.baseURL,
    nodeHistoryPlaceholder: defaultNode.historyBaseURL,
    explorerOptions: getExplorerOptions(platform),
    explorerPlaceholder: getDefaultExplorer(platform).baseURL,
  };
}

export default {
  components: {
    CsButton,
    CsFormGroup,
    CsFormInput,
    CsFormSelect,
    MainLayout,
  },
  extends: CsStep,
  data() {
    return {
      chain: undefined,
      explorer: {},
      explorerError: undefined,
      isLoading: false,
      node: {},
      nodeError: undefined,
      nodeResult: undefined,
    };
  },
  computed: {
    platform() {
      return this.args?.platform;
    },
    title() {
      return this.chain?.name || this.$t('Nodes');
    },
  },
  watch: {
    platform: {
      immediate: true,
      handler(platform) {
        if (!platform) return;
        this.reset(platform);
      },
    },
  },
  methods: {
    reset(platform) {
      this.chain = buildChain(platform);
      this.node = { ...this.$account.getNode(platform) };
      this.explorer = { ...this.$account.settings.getExplorer(platform) };
      this.nodeError = undefined;
      this.explorerError = undefined;
      this.nodeResult = undefined;
    },
    async updateNodePreset(preset) {
      this.nodeError = undefined;
      this.nodeResult = undefined;
      if (preset === 'custom') {
        this.node = {
          ...this.node,
          preset,
        };
        return;
      }
      await this.$account.setNode(this.platform, { preset });
      this.node = { ...this.$account.getNode(this.platform) };
      this.nodeResult = {
        success: true,
        message: 'Saved',
      };
    },
    async saveNode() {
      this.nodeError = undefined;
      this.nodeResult = undefined;
      this.isLoading = true;
      try {
        await this.$account.setNode(this.platform, this.node);
        this.node = { ...this.$account.getNode(this.platform) };
        this.nodeResult = {
          success: true,
          message: 'Saved',
        };
      } catch (err) {
        this.nodeError = 'Invalid URL';
      } finally {
        this.isLoading = false;
      }
    },
    async testNode() {
      this.nodeError = undefined;
      this.nodeResult = undefined;
      this.isLoading = true;
      try {
        this.nodeResult = await this.$account.testNode(this.platform, this.node);
      } catch (err) {
        this.nodeError = err?.message || 'Connection failed';
        this.nodeResult = {
          success: false,
          message: 'Connection failed',
        };
      } finally {
        this.isLoading = false;
      }
    },
    async updateExplorerPreset(preset) {
      this.explorerError = undefined;
      if (preset === 'custom') {
        this.explorer = {
          ...this.explorer,
          preset,
        };
        return;
      }
      await this.$account.setExplorer(this.platform, { preset });
      this.explorer = { ...this.$account.settings.getExplorer(this.platform) };
    },
    async saveExplorer() {
      this.explorerError = undefined;
      this.isLoading = true;
      try {
        await this.$account.setExplorer(this.platform, this.explorer);
        this.explorer = { ...this.$account.settings.getExplorer(this.platform) };
      } catch (err) {
        this.explorerError = 'Invalid URL';
      } finally {
        this.isLoading = false;
      }
    },
  },
};
</script>

<template>
  <MainLayout :title="title">
    <CsFormGroup v-if="chain">
      <div class="&__panel">
        <CsFormSelect
          :modelValue="node.preset"
          :options="chain.nodeOptions"
          :label="$t('Node source')"
          @update:modelValue="updateNodePreset"
        />
        <CsFormInput
          v-if="node.preset === 'custom'"
          v-model="node.baseURL"
          :label="$t('Custom node URL')"
          :placeholder="chain.nodePlaceholder"
          :error="nodeError"
          :clear="true"
          @update:modelValue="nodeError = undefined"
        />
        <CsFormInput
          v-if="node.preset === 'custom' && chain.nodeHistoryPlaceholder !== undefined"
          v-model="node.historyBaseURL"
          :label="$t('History API URL')"
          :placeholder="chain.nodeHistoryPlaceholder"
          :clear="true"
          @update:modelValue="nodeError = undefined"
        />
        <div class="&__actions">
          <CsButton
            type="primary-light"
            small
            @click="testNode"
          >
            {{ $t('Test') }}
          </CsButton>
          <CsButton
            v-if="node.preset === 'custom'"
            type="primary-light"
            small
            @click="saveNode"
          >
            {{ $t('Save') }}
          </CsButton>
        </div>
        <div
          v-if="nodeResult"
          class="&__status"
          :class="{
            '&__status--success': nodeResult.success,
            '&__status--danger': !nodeResult.success,
          }"
        >
          {{ nodeResult.message }}
        </div>

        <CsFormSelect
          :modelValue="explorer.preset"
          :options="chain.explorerOptions"
          :label="$t('Block explorer')"
          @update:modelValue="updateExplorerPreset"
        />
        <CsFormInput
          v-if="explorer.preset === 'custom'"
          v-model="explorer.baseURL"
          :label="$t('Custom explorer URL')"
          :placeholder="chain.explorerPlaceholder"
          :error="explorerError"
          :clear="true"
          @update:modelValue="explorerError = undefined"
        />
        <CsButton
          v-if="explorer.preset === 'custom'"
          type="primary-light"
          small
          @click="saveExplorer"
        >
          {{ $t('Save') }}
        </CsButton>
      </div>
    </CsFormGroup>
  </MainLayout>
</template>

<style lang="scss">
  .#{ $filename } {
    &__panel {
      display: flex;
      flex-direction: column;
      padding: $spacing-lg;
      border: 1px solid $gray;
      border-radius: $spacing-md;
      gap: $spacing-md;
    }

    &__actions {
      display: flex;
      gap: $spacing-sm;
    }

    &__status {
      @include text-sm;
      color: $secondary;

      &--success {
        color: $primary;
      }

      &--danger {
        color: $danger;
      }
    }
  }
</style>
