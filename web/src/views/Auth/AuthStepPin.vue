<script>
import AuthStepLayout from '../../layouts/AuthStepLayout.vue';
import CsPasscodeUnlock from '../../components/CsPasscodeUnlock.vue';
import CsStep from '../../components/CsStep.vue';

import { redirectToApp } from '../../lib/mixins.js';

export default {
  components: {
    AuthStepLayout,
    CsPasscodeUnlock,
  },
  extends: CsStep,
  mixins: [redirectToApp],
  methods: {
    async setup(passcode, passcodeType) {
      await this.$account.create(this.storage.seed, passcode, passcodeType);

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
    :title="$t('Set a passcode')"
    :description="$t('for quick access')"
  >
    <CsPasscodeUnlock
      mode="setup"
      passcodeType="pin"
      allowTypeSwitch
      :onSuccess="setup"
    />
  </AuthStepLayout>
</template>
