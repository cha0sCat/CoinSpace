<script>
import CsSteps from '../../../components/CsSteps.vue';
import CsUnlockStep from '../../../components/CsUnlockStep.vue';

import CryptoExportStepIndex from './CryptoExportStepIndex.vue';
import CryptoExportStepShow from './CryptoExportStepShow.vue';

export default {
  components: {
    CsSteps,
  },
  steps: {
    index: CryptoExportStepIndex,
    unlock: CsUnlockStep,
    show: CryptoExportStepShow,
  },
};
</script>

<template>
  <CsSteps
    :steps="$options.steps"
  />
</template>
