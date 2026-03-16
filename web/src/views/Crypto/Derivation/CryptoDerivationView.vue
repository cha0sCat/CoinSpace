<script>
import CsSteps from '../../../components/CsSteps.vue';
import CsUnlockStep from '../../../components/CsUnlockStep.vue';

import CryptoDerivationStepIndex from './CryptoDerivationStepIndex.vue';

export default {
  components: {
    CsSteps,
  },
  steps: {
    index: CryptoDerivationStepIndex,
    unlock: CsUnlockStep,
  },
};
</script>

<template>
  <CsSteps
    :steps="$options.steps"
  />
</template>
