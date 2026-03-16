<script>
import CsPassword from './CsPassword.vue';
import CsPinUnlock from './CsPinUnlock.vue';

export default {
  components: {
    CsPassword,
    CsPinUnlock,
  },
  props: {
    mode: {
      type: String,
      default: 'deviceSeed',
    },
    method: {
      type: String,
      default: 'pin',
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
  data() {
    return {
      currentMethod: this.method || 'pin',
    };
  },
  computed: {
    canUsePassword() {
      return this.mode !== 'setup' && this.$account.passwordUnlock.isEnabled;
    },
    canUsePin() {
      return this.mode !== 'setup';
    },
  },
  watch: {
    method(value) {
      this.currentMethod = value || 'pin';
    },
  },
  methods: {
    usePassword() {
      this.currentMethod = 'password';
    },
    usePin() {
      this.currentMethod = 'pin';
    },
    reset() {
      this.currentMethod = this.method || 'pin';
      this.$refs.method?.reset?.();
    },
  },
};
</script>

<template>
  <CsPinUnlock
    v-if="currentMethod === 'pin'"
    ref="method"
    :key="`pin:${mode}`"
    :mode="mode"
    :logoutButton="logoutButton"
    :onSuccess="onSuccess"
    :onUsePassword="canUsePassword ? usePassword : undefined"
  />
  <CsPassword
    v-else
    ref="method"
    :key="`password:${mode}`"
    :mode="mode"
    :onSuccess="onSuccess"
    :onUsePin="canUsePin ? usePin : undefined"
  />
</template>
