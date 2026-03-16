<script>
import CsStep from '../../../components/CsStep.vue';

import CsButton from '../../../components/CsButton.vue';
import CsButtonGroup from '../../../components/CsButtonGroup.vue';
import CsFormGroup from '../../../components/CsForm/CsFormGroup.vue';
import CsFormInput from '../../../components/CsForm/CsFormInput.vue';
import CsListItem from '../../../components/CsListItem.vue';
import CsListItems from '../../../components/CsListItems.vue';
import CsModal from '../../../components/CsModal.vue';
import MainLayout from '../../../layouts/MainLayout.vue';
import { objectsIsEqual } from '../../../lib/helpers.js';

function parseIndexedPath(path) {
  const match = String(path || '').trim().match(/^(.*\/)(\d+)('?)$/);
  if (match) {
    return {
      prefix: match[1],
      index: Number(match[2]),
      hardened: match[3] === "'",
    };
  }
  return {
    prefix: String(path || '').trim(),
    index: 0,
    hardened: false,
  };
}

function normalizePrefix(prefix) {
  const value = String(prefix || '').trim();
  if (!value) return '';
  return value.endsWith('/') ? value : `${value}/`;
}

export default {
  components: {
    MainLayout,
    CsButton,
    CsButtonGroup,
    CsFormGroup,
    CsFormInput,
    CsListItem,
    CsListItems,
    CsModal,
  },
  extends: CsStep,
  data() {
    return {
      isLoading: false,
      isDiscovering: false,
      isEditingPrefix: false,
      discoveryScanned: 0,
      discoveryTotal: 0,
      originalPrefixes: {},
      prefixes: {},
      markers: {},
      fieldIndices: {},
      errors: {},
      switchIndex: '',
      switchError: '',
      discovered: [],
      discoveryError: '',
      walletSeedCache: undefined,
      confirmEntry: undefined,
    };
  },
  computed: {
    settingsWallet() {
      return this.$account.getAddressSettingsWallet(this.$wallet);
    },
    fieldKeys() {
      return this.settingsWallet.isAddressTypesSupported ? ['bip84', 'bip49', 'bip44'] : ['bip44'];
    },
    currentIndex() {
      const indices = this.fieldKeys.map((key) => this.fieldIndices[key]);
      const [first] = indices;
      return indices.every((value) => value === first) ? first : null;
    },
    hasMixedIndexes() {
      return this.currentIndex === null;
    },
    fieldDefinitions() {
      return this.fieldKeys.map((key) => {
        return {
          key,
          label: this.fieldLabel(key),
          prefix: this.prefixes[key],
          currentPath: this.buildPath(this.prefixes[key], this.fieldIndices[key], this.markers[key]),
        };
      });
    },
    currentPathSummary() {
      if (this.fieldDefinitions.length === 1) {
        return this.fieldDefinitions[0].currentPath;
      }
      return this.fieldDefinitions.map((field) => {
        return `${field.label}: ${field.currentPath}`;
      }).join(' · ');
    },
    currentPathCaption() {
      if (!this.currentPathSummary) return '';
      return `(${this.$t('Current')}: ${this.currentPathSummary})`;
    },
    switchInputError() {
      return typeof this.switchError === 'string' ? this.switchError : '';
    },
    discoveryProgressValue() {
      if (!this.discoveryTotal) return 0;
      return Math.min(100, Math.round((this.discoveryScanned / this.discoveryTotal) * 100));
    },
    discoveryProgressCaption() {
      if (!this.discoveryTotal) return '';
      return `${this.$t('Scanning activated addresses...')} ${this.discoveryScanned}/${this.discoveryTotal}`;
    },
  },
  watch: {
    prefixes: {
      handler() {
        if (this.isEditingPrefix) {
          this.validatePrefixes();
        }
      },
      deep: true,
    },
    switchIndex() {
      if (this.switchError) {
        this.switchError = '';
      }
    },
  },
  async mounted() {
    this.resetFromWallet();
    await this.discoverAddresses();
  },
  beforeUnmount() {
    this.walletSeedCache = undefined;
  },
  methods: {
    fieldLabel(key) {
      if (key === 'bip84') return this.$t('Bech32 - SegWit native');
      if (key === 'bip49') return this.$t('P2SH - SegWit compatible');
      if (key === 'bip44' && this.settingsWallet.isAddressTypesSupported) return this.$t('P2PKH - Legacy');
      return this.$t('Derivation path');
    },
    buildPath(prefix, index, hardened) {
      return `${normalizePrefix(prefix)}${index}${hardened ? "'" : ''}`;
    },
    resetFromWallet() {
      const originalPrefixes = {};
      const prefixes = {};
      const markers = {};
      const fieldIndices = {};

      for (const key of this.fieldKeys) {
        const parsed = parseIndexedPath(this.settingsWallet.settings[key]);
        originalPrefixes[key] = parsed.prefix;
        prefixes[key] = parsed.prefix;
        markers[key] = parsed.hardened;
        fieldIndices[key] = parsed.index;
      }

      this.originalPrefixes = originalPrefixes;
      this.prefixes = prefixes;
      this.markers = markers;
      this.fieldIndices = fieldIndices;
      this.switchIndex = String(this.currentIndex ?? fieldIndices[this.fieldKeys[0]] ?? 0);
      this.switchError = '';
      this.errors = {};
    },
    validatePrefixes(indexOverride) {
      const errors = {};
      for (const key of this.fieldKeys) {
        const path = this.buildPath(this.prefixes[key], indexOverride ?? this.fieldIndices[key], this.markers[key]);
        errors[key] = this.settingsWallet.validateDerivationPath(path) ? false : this.$t('Invalid path');
      }
      this.errors = errors;
      return !Object.values(errors).some(Boolean);
    },
    buildSettings(indexOverride) {
      const settings = { ...this.settingsWallet.settings };
      for (const key of this.fieldKeys) {
        settings[key] = this.buildPath(this.prefixes[key], indexOverride ?? this.fieldIndices[key], this.markers[key]);
      }
      return settings;
    },
    async ensureWalletSeed() {
      if (this.walletSeedCache) {
        return this.walletSeedCache;
      }
      const walletSeed = await this.$account.getNormalSecurityWalletSeed();
      this.walletSeedCache = walletSeed;
      return walletSeed;
    },
    async discoverAddresses() {
      const walletSeed = await this.ensureWalletSeed();
      if (!walletSeed) return;

      this.isDiscovering = true;
      this.discoveryError = '';
      this.discovered = [];
      try {
        const currentIndex = this.currentIndex ?? this.fieldIndices[this.fieldKeys[0]] ?? 0;
        let consecutiveInactive = 0;
        this.discoveryScanned = 0;
        this.discoveryTotal = Math.max(currentIndex + 1, 5);

        for (let index = 0; index <= currentIndex || consecutiveInactive < 5; index++) {
          const preview = await this.$account.inspectAddressSettings(
            this.$wallet,
            this.buildSettings(index),
            walletSeed
          );
          const isCurrent = index === currentIndex;
          const isActive = preview.active || isCurrent;

          if (preview.active) {
            consecutiveInactive = 0;
          } else {
            consecutiveInactive++;
          }

          this.discoveryScanned = index + 1;
          this.discoveryTotal = Math.max(
            currentIndex + 1,
            this.discoveryScanned + Math.max(0, 5 - consecutiveInactive)
          );

          if (isActive) {
            this.discovered.push({
              index,
              address: preview.address,
              balance: preview.balance ?? (isCurrent ? this.$wallet.balance : undefined),
              current: isCurrent,
            });
          }
        }
      } catch (err) {
        console.error(err);
        this.discoveryError = this.$t('Please try again later.');
      } finally {
        this.isDiscovering = false;
      }
    },
    formatBalance(balance) {
      if (!balance) return '-';
      return `${balance.toString()} ${this.$wallet.crypto.symbol}`;
    },
    async savePrefixes() {
      if (!this.validatePrefixes()) return;
      const settings = this.buildSettings();
      if (objectsIsEqual(settings, this.settingsWallet.settings)) {
        this.isEditingPrefix = false;
        return;
      }

      const walletSeed = await this.ensureWalletSeed();
      if (!walletSeed) return;

      this.isLoading = true;
      try {
        await this.$account.updatePlatformSettings(this.settingsWallet, settings, walletSeed);
        await this.$wallet.load();
        if (this.settingsWallet !== this.$wallet) {
          await this.settingsWallet.load();
        }
        this.resetFromWallet();
        this.isEditingPrefix = false;
        await this.discoverAddresses();
      } catch (err) {
        console.error(err);
      } finally {
        this.isLoading = false;
      }
    },
    async switchToIndex(index) {
      this.switchError = '';
      if (!Number.isInteger(index) || index < 0) {
        this.switchError = this.$t('Invalid value');
        return;
      }
      if (!this.validatePrefixes(index)) return;

      const settings = this.buildSettings(index);
      if (objectsIsEqual(settings, this.settingsWallet.settings)) {
        this.confirmEntry = undefined;
        return;
      }

      const walletSeed = await this.ensureWalletSeed();
      if (!walletSeed) return;

      this.isLoading = true;
      this.switchError = '';
      try {
        await this.$account.updatePlatformSettings(this.settingsWallet, settings, walletSeed);
        await this.$wallet.load();
        if (this.settingsWallet !== this.$wallet) {
          await this.settingsWallet.load();
        }
        this.resetFromWallet();
        await this.discoverAddresses();
      } catch (err) {
        console.error(err);
      } finally {
        this.confirmEntry = undefined;
        this.isLoading = false;
      }
    },
    async switchByInput() {
      const index = Number.parseInt(this.switchIndex, 10);
      await this.switchToIndex(index);
    },
    cancelPrefixEdit() {
      this.isEditingPrefix = false;
      this.prefixes = { ...this.originalPrefixes };
      this.validatePrefixes();
    },
    openConfirm(entry) {
      this.confirmEntry = entry;
    },
  },
};
</script>

<template>
  <MainLayout :title="$t('Switch address')">
    <div class="&__note">
      {{
        $t('Switch the derived wallet address by changing the account index under the current derivation path prefix.')
      }}
    </div>

    <CsFormGroup class="&__group">
      <div class="&__sectionHeader">
        <div class="&__sectionTitle">
          {{ $t('Derivation path') }}
        </div>
        <button
          v-if="!isEditingPrefix"
          type="button"
          class="&__editLink"
          @click="isEditingPrefix = true"
        >
          {{ $t('Edit prefix') }}
        </button>
      </div>
      <CsFormInput
        v-for="field in fieldDefinitions"
        :key="field.key"
        v-model="prefixes[field.key]"
        :label="field.label"
        :error="errors[field.key]"
        :readonly="!isEditingPrefix"
      />
      <CsButtonGroup v-if="isEditingPrefix">
        <CsButton
          type="primary"
          :isLoading="isLoading"
          @click="savePrefixes"
        >
          {{ $t('Save prefix') }}
        </CsButton>
        <CsButton
          type="primary-link"
          @click="cancelPrefixEdit"
        >
          {{ $t('Cancel') }}
        </CsButton>
      </CsButtonGroup>
    </CsFormGroup>

    <CsFormGroup class="&__group">
      <div class="&__sectionTitle">
        {{ $t('Switch address') }}
        <span
          v-if="currentPathCaption"
          class="&__sectionMeta"
        >
          {{ currentPathCaption }}
        </span>
      </div>
      <CsFormInput
        v-model="switchIndex"
        :label="$t('Address index')"
        :error="switchInputError"
      />
      <CsButton
        type="primary"
        :isLoading="isLoading"
        @click="switchByInput"
      >
        {{ $t('Switch address') }}
      </CsButton>
      <div
        v-if="hasMixedIndexes"
        class="&__hint"
      >
        {{ $t('Current address types are using different indexes. Switching will align them to one index.') }}
      </div>
    </CsFormGroup>

    <CsListItems
      class="&__list"
      :title="$t('Activated addresses')"
    >
      <CsListItem
        v-for="entry in discovered"
        :key="entry.index"
        :disabled="isLoading || entry.current"
        :title="entry.current ? `#${entry.index} (${$t('Current')})` : `#${entry.index}`"
        :description="entry.address"
        @click="openConfirm(entry)"
      >
        <template #after>
          <div class="&__balance">
            {{ formatBalance(entry.balance) }}
          </div>
        </template>
      </CsListItem>
      <div
        v-if="isDiscovering"
        class="&__progress"
      >
        <div class="&__progressCaption">
          {{ discoveryProgressCaption }}
        </div>
        <div
          class="&__progressTrack"
          role="progressbar"
          :aria-valuemin="0"
          :aria-valuemax="discoveryTotal"
          :aria-valuenow="discoveryScanned"
          :aria-label="discoveryProgressCaption"
        >
          <div
            class="&__progressFill"
            :style="{ width: `${discoveryProgressValue}%` }"
          />
        </div>
      </div>
      <div
        v-else-if="discoveryError"
        class="&__hint"
      >
        {{ discoveryError }}
      </div>
      <div
        v-else-if="discovered.length === 0"
        class="&__hint"
      >
        {{ $t('No activated addresses found.') }}
      </div>
    </CsListItems>

    <CsModal
      :show="!!confirmEntry"
      :title="$t('Switch address')"
      @close="confirmEntry = undefined"
    >
      <div v-if="confirmEntry">
        {{ $t('Switch to address #{index}?', { index: confirmEntry.index }) }}
      </div>
      <div v-if="confirmEntry">
        {{ confirmEntry.address }}
      </div>
      <template #footer>
        <CsButtonGroup>
          <CsButton
            type="primary"
            :isLoading="isLoading"
            @click="confirmEntry && switchToIndex(confirmEntry.index)"
          >
            {{ $t('Confirm') }}
          </CsButton>
          <CsButton
            type="primary-link"
            @click="confirmEntry = undefined"
          >
            {{ $t('Cancel') }}
          </CsButton>
        </CsButtonGroup>
      </template>
    </CsModal>
  </MainLayout>
</template>

<style lang="scss">
  .#{ $filename } {
    display: flex;
    flex-direction: column;
    gap: $spacing-lg;

    &__group {
      gap: $spacing-sm;
    }

    &__list {
      margin-top: calc(-1 * $spacing-xs);
    }

    &__note,
    &__hint,
    &__path,
    &__balance,
    &__progressCaption {
      @include text-md;
    }

    &__note,
    &__hint,
    &__path {
      color: $secondary;
    }

    &__note {
      margin-bottom: calc(-1 * $spacing-xs);
    }

    &__sectionTitle {
      @include text-md;
      @include text-bold;
      margin-bottom: $spacing-2xs;
    }

    &__sectionMeta {
      color: $secondary;
      font-weight: 400;
    }

    &__sectionHeader {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: $spacing-sm;
    }

    &__editLink {
      @include text-sm;
      border: none;
      background: transparent;
      color: $primary-brand;
      cursor: pointer;
      padding: 0;
      white-space: nowrap;

      &:hover,
      &:focus-visible {
        text-decoration: underline;
      }
    }

    &__balance {
      text-align: right;
      white-space: nowrap;
    }

    &__progress {
      display: flex;
      flex-direction: column;
      gap: $spacing-2xs;
    }

    &__progressTrack {
      height: 0.5rem;
      border-radius: 999px;
      background-color: $secondary-light;
      overflow: hidden;
    }

    &__progressFill {
      height: 100%;
      border-radius: 999px;
      background-color: $primary-brand;
      transition: width 0.15s ease-in-out;
    }
  }
</style>
