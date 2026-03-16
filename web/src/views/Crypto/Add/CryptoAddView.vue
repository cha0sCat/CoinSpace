<script>
import CsSteps from '../../../components/CsSteps.vue';
import CsUnlockStep from '../../../components/CsUnlockStep.vue';

import CryptoAddStepCustomToken from './CryptoAddStepCustomToken.vue';
import CryptoAddStepFilterBlockchain from './CryptoAddStepFilterBlockchain.vue';
import CryptoAddStepIndex from './CryptoAddStepIndex.vue';
import CryptoAddStepQr from './CryptoAddStepQr.vue';
import CryptoAddStepSelectBlockchain from './CryptoAddStepSelectBlockchain.vue';
import CryptoAddStepTokenInfo from './CryptoAddStepTokenInfo.vue';

export default {
  components: {
    CsSteps,
  },
  steps: {
    index: CryptoAddStepIndex,
    customToken: CryptoAddStepCustomToken,
    selectBlockchain: CryptoAddStepSelectBlockchain,
    filterBlockchain: CryptoAddStepFilterBlockchain,
    tokenInfo: CryptoAddStepTokenInfo,
    qr: CryptoAddStepQr,
    unlock: CsUnlockStep,
  },
};
</script>

<template>
  <CsSteps
    :steps="$options.steps"
    :initialStorage="{ platform: 'ethereum@ethereum' }"
  />
</template>
