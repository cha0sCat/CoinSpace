<script>
import CsPinStep from '../../../components/CsPinStep.vue';
import CsSteps from '../../../components/CsSteps.vue';

import CryptoReceiveStepIndex from './CryptoReceiveStepIndex.vue';

export default {
  components: {
    CsSteps,
  },
  steps: {
    index: CryptoReceiveStepIndex,
    pin: CsPinStep,
  },
};
</script>

<template>
  <CsSteps
    :steps="$options.steps"
  />
</template>
