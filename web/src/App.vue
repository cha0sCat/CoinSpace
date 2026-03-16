<script>
import { RouterView } from 'vue-router';

export default {
  components: {
    RouterView,
  },
  mounted() {
    if (this.env.VITE_BUILD_TYPE === 'phonegap') {
      window.navigator.splashscreen.hide();
    }
  },
};
</script>

<template>
  <RouterView />
</template>

<style lang="scss">
  #app {
    width: 100%;
    height: 100%;
  }
</style>
