<script>
import CsSteps from '../../../components/CsSteps.vue';
import CsUnlockStep from '../../../components/CsUnlockStep.vue';

import CryptoReceiveStepIndex from './CryptoReceiveStepIndex.vue';

export default {
  components: {
    CsSteps,
  },
  steps: {
    index: CryptoReceiveStepIndex,
    unlock: CsUnlockStep,
  },
};
</script>

<template>
  <CsSteps
    :steps="$options.steps"
  />
</template>
