<script>
import CsPasscodeUnlock from './CsPasscodeUnlock.vue';

export default {
  components: {
    CsPasscodeUnlock,
  },
  props: {
    mode: {
      type: String,
      default: 'deviceSeed',
    },
    passcodeType: {
      type: String,
      default: undefined,
    },
    allowTypeSwitch: {
      type: Boolean,
      default: false,
    },
    logoutButton: {
      type: Boolean,
      default: false,
    },
    onSuccess: {
      type: Function,
      default: undefined,
    },
  },
  methods: {
    reset() {
      this.$refs.passcode?.reset?.();
    },
  },
};
</script>

<template>
  <CsPasscodeUnlock
    ref="passcode"
    :key="`${mode}:${passcodeType || 'active'}`"
    :mode="mode"
    :passcodeType="passcodeType"
    :allowTypeSwitch="allowTypeSwitch"
    :logoutButton="logoutButton"
    :onSuccess="onSuccess"
  />
</template>
