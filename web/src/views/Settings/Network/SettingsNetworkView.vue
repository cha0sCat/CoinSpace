<script>
import CsSteps from '../../../components/CsSteps.vue';

import SettingsNetworkStepIndex from './SettingsNetworkStepIndex.vue';

export default {
  components: {
    CsSteps,
  },
  steps: {
    index: SettingsNetworkStepIndex,
  },
};
</script>

<template>
  <CsSteps :steps="$options.steps" />
</template>
