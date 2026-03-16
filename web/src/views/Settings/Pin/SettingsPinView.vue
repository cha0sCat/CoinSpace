<script>
import CsSteps from '../../../components/CsSteps.vue';
import CsUnlockStep from '../../../components/CsUnlockStep.vue';

import SettingsPinStepIndex from './SettingsPinStepIndex.vue';

export default {
  components: {
    CsSteps,
  },
  steps: {
    index: SettingsPinStepIndex,
    unlock: CsUnlockStep,
  },
};
</script>

<template>
  <CsSteps
    :steps="$options.steps"
  />
</template>
