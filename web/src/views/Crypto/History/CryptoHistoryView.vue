<script>
import CsSteps from '../../../components/CsSteps.vue';
import CsUnlockStep from '../../../components/CsUnlockStep.vue';

import CryptoHistoryStepAccelerate from './CryptoHistoryStepAccelerate.vue';
import CryptoHistoryStepAccelerateStatus from './CryptoHistoryStepAccelerateStatus.vue';
import CryptoHistoryStepList from './CryptoHistoryStepList.vue';
import CryptoHistoryStepTransaction from './CryptoHistoryStepTransaction.vue';

export default {
  components: {
    CsSteps,
  },
  steps: {
    index: CryptoHistoryStepList,
    accelerate: CryptoHistoryStepAccelerate,
    accelerateStatus: CryptoHistoryStepAccelerateStatus,
    transaction: CryptoHistoryStepTransaction,
    unlock: CsUnlockStep,
  },
};
</script>

<template>
  <CsSteps
    :steps="$options.steps"
  />
</template>
