<script>
import AuthStepLayout from '../../layouts/AuthStepLayout.vue';
import CsPinUnlock from '../../components/CsPinUnlock.vue';
import CsStep from '../../components/CsStep.vue';

import { redirectToApp } from '../../lib/mixins.js';

export default {
  components: {
    AuthStepLayout,
    CsPinUnlock,
  },
  extends: CsStep,
  mixins: [redirectToApp],
  methods: {
    async setup(pin) {
      await this.$account.create(this.storage.seed, pin);

      if (this.$account.biometry.isAvailable || this.$account.webAuthn.isAvailable) {
        this.next('biometry');
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
    :title="$t('Set a PIN')"
    :description="$t('for quick access')"
  >
    <CsPinUnlock
      mode="setup"
      :onSuccess="setup"
    />
  </AuthStepLayout>
</template>
