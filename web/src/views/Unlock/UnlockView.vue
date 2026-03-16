<script>
import CsSteps from '../../components/CsSteps.vue';
import CsUnlockStep from '../../components/CsUnlockStep.vue';

import CsSelectCryptosStep from '../../components/CsSelectCryptosStep.vue';
import UnlockStepIndex from './UnlockStepIndex.vue';
import UnlockStepSynchronization from './UnlockStepSynchronization.vue';

export default {
  components: {
    CsSteps,
  },
  steps: {
    index: UnlockStepIndex,
    synchronization: UnlockStepSynchronization,
    unlock: CsUnlockStep,
    selectCryptos: CsSelectCryptosStep,
  },
};
</script>

<template>
  <CsSteps
    :steps="$options.steps"
  />
</template>
