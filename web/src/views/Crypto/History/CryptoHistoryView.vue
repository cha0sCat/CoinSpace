<script>
import CsPasswordStep from '../../../components/CsPasswordStep.vue';
import CsPinStep from '../../../components/CsPinStep.vue';
import CsSteps from '../../../components/CsSteps.vue';

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
