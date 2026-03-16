<script>
import CsSteps from '../../../components/CsSteps.vue';

import SettingsNodesStepChain from './SettingsNodesStepChain.vue';
import SettingsNodesStepIndex from './SettingsNodesStepIndex.vue';

export default {
  components: {
    CsSteps,
  },
  steps: {
    index: SettingsNodesStepIndex,
    chain: SettingsNodesStepChain,
  },
};
</script>

<template>
  <CsSteps :steps="$options.steps" />
</template>
