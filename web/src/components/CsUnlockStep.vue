<script>
import AuthStepLayout from '../layouts/AuthStepLayout.vue';
import MainLayout from '../layouts/MainLayout.vue';

import CsStep from './CsStep.vue';
import CsUnlock from './CsUnlock.vue';

export default {
  components: {
    AuthStepLayout,
    CsUnlock,
    MainLayout,
  },
  extends: CsStep,
  computed: {
    title() {
      return this.args?.title || this.$t('Unlock');
    },
  },
};
</script>

<template>
  <component
    :is="args.layout"
    :title="title"
  >
    <CsUnlock
      :mode="args.mode"
      :method="args.method"
      :logoutButton="args.logoutButton"
      :onSuccess="args.success"
    />
  </component>
</template>
