<script>
import CsSteps from '../../../components/CsSteps.vue';
import CsUnlockStep from '../../../components/CsUnlockStep.vue';

import SettingsAccountStepIndex from './SettingsAccountStepIndex.vue';
import SettingsAccountStepRemove from './SettingsAccountStepRemove.vue';

export default {
  components: {
    CsSteps,
  },
  steps: {
    index: SettingsAccountStepIndex,
    remove: SettingsAccountStepRemove,
    unlock: CsUnlockStep,
  },
};
</script>

<template>
  <CsSteps
    :steps="$options.steps"
  />
</template>
