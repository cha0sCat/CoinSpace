<script>
import AuthStepLayout from '../../layouts/AuthStepLayout.vue';
import CsStep from '../../components/CsStep.vue';
import CsUnlock from '../../components/CsUnlock.vue';
import { onShowOnHide, redirectToApp } from '../../lib/mixins.js';

export default {
  components: {
    AuthStepLayout,
    CsUnlock,
  },
  extends: CsStep,
  mixins: [onShowOnHide, redirectToApp],
  data() {
    return {
      isReady: this.env.VITE_PLATFORM !== 'android',
    };
  },
  onShow() {
    if (this.env.VITE_PLATFORM === 'android') {
      setTimeout(() => {
        this.isReady = true;
        window.systemBars.setStyle('light');
      }, 500);
    }
  },
  onHide() {
    this.$refs.pin?.reset?.();
  },
  methods: {
    async success(deviceSeed) {
      await this.$account.open(deviceSeed);
      this.done();
    },
    done() {
      if (this.$account.walletsNeedSynchronization.length) {
        this.next('synchronization');
      } else if (this.$account.cryptosToSelect) {
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
    :title="$t('Unlock')"
    :showBack="false"
    :centered="true"
  >
    <CsUnlock
      v-if="isReady"
      ref="pin"
      mode="deviceSeed"
      logoutButton
      :onSuccess="success"
    />
  </AuthStepLayout>
</template>
