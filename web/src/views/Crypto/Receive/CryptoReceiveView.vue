<script>
import CsPasswordStep from '../../../components/CsPasswordStep.vue';
import CsPinStep from '../../../components/CsPinStep.vue';
import CsSteps from '../../../components/CsSteps.vue';

import CryptoReceiveStepIndex from './CryptoReceiveStepIndex.vue';

export default {
  components: {
    CsSteps,
  },
  steps: {
    index: CryptoReceiveStepIndex,
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
