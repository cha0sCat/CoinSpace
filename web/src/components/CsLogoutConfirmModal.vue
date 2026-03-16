<script>
import CsButton from './CsButton.vue';
import CsButtonGroup from './CsButtonGroup.vue';
import CsModal from './CsModal.vue';
import CsWarning from './CsWarning.vue';

export default {
  components: {
    CsButton,
    CsButtonGroup,
    CsModal,
    CsWarning,
  },
  props: {
    show: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['close', 'confirm'],
  data() {
    return {
      step: 1,
    };
  },
  computed: {
    config() {
      switch (this.step) {
        case 1:
          return {
            title: this.$t('Log out'),
            message: this.$t('Logging out will remove this wallet from this device.'),
            warning: this.$t('You will need your passphrase to restore access.'),
            action: this.$t('Continue'),
          };
        case 2:
          return {
            title: this.$t('Are you absolutely sure?'),
            message: this.$t('All locally stored wallet data on this device will be cleared.'),
            warning: this.$t('This action cannot be undone on this device.'),
            action: this.$t('Continue'),
          };
        case 3:
          return {
            title: this.$t('Final warning'),
            message: this.$t('If you log out now, this device will forget your wallet until you import it again.'),
            warning: this.$t('Only continue if you have your passphrase available.'),
            action: this.$t('Log out now'),
          };
        default:
          return undefined;
      }
    },
    isFinalStep() {
      return this.step >= 3;
    },
  },
  watch: {
    show(value) {
      if (value) {
        this.step = 1;
      }
    },
  },
  methods: {
    close() {
      this.$emit('close');
    },
    continueOrConfirm() {
      if (!this.isFinalStep) {
        this.step += 1;
        return;
      }
      this.$emit('confirm');
    },
  },
};
</script>

<template>
  <CsModal
    :show="show"
    :title="config?.title || $t('Log out')"
    @close="close"
  >
    <div class="&__content">
      <div class="&__message">
        {{ config?.message }}
      </div>
      <CsWarning>
        {{ config?.warning }}
      </CsWarning>
    </div>
    <template #footer>
      <CsButtonGroup>
        <CsButton
          type="primary-light"
          @click="close"
        >
          {{ $t('Cancel') }}
        </CsButton>
        <CsButton
          :type="isFinalStep ? 'danger-light' : 'primary'"
          @click="continueOrConfirm"
        >
          {{ config?.action }}
        </CsButton>
      </CsButtonGroup>
    </template>
  </CsModal>
</template>

<style lang="scss">
  .#{ $filename } {
    &__content {
      display: flex;
      flex-direction: column;
      gap: $spacing-md;
    }

    &__message {
      @include text-md;
    }
  }
</style>
