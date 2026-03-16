<script>
import AuthStepLayout from '../layouts/AuthStepLayout.vue';
import MainLayout from '../layouts/MainLayout.vue';

import CsPassword from './CsPassword.vue';
import CsStep from './CsStep.vue';

export default {
  components: {
    AuthStepLayout,
    CsPassword,
    MainLayout,
  },
  extends: CsStep,
  computed: {
    title() {
      if (this.args?.title) {
        return this.args.title;
      }
      return this.args?.mode === 'setup' ? this.$t('Set a password') : this.$t('Enter your password');
    },
  },
  methods: {
    usePin() {
      this.next('pin', this.args);
    },
  },
};
</script>

<template>
  <component
    :is="args.layout"
    :title="title"
  >
    <CsPassword
      :mode="args.mode"
      :onSuccess="args.success"
      :onUsePin="args.allowPin === false ? undefined : usePin"
    />
  </component>
</template>
