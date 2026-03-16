<script>
import CsPasswordStep from '../../../components/CsPasswordStep.vue';
import CsPinStep from '../../../components/CsPinStep.vue';
import CsSteps from '../../../components/CsSteps.vue';

import SettingsPinStepIndex from './SettingsPinStepIndex.vue';

export default {
  components: {
    CsSteps,
  },
  steps: {
    index: SettingsPinStepIndex,
    password: CsPasswordStep,
    pin: CsPinStep,
  },
};
</script>

<template>
  <CsSteps
    :steps="$options.steps"
  />
</template>
