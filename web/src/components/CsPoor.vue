<script>
import CsButton from './CsButton.vue';
import CsButtonGroup from './CsButtonGroup.vue';

import ReceiveIcon from '../assets/svg/receive.svg';

export default {
  components: {
    CsButton,
    CsButtonGroup,
    ReceiveIcon,
  },
};
</script>

<template>
  <div class="&__content">
    {{ $t('Receive {symbol}', { symbol: $wallet.crypto.symbol }) }}
  </div>
  <CsButtonGroup
    class="&__actions"
    type="circle"
  >
    <CsButton
      type="circle"
      @click="$router.push({ name: 'crypto.receive', params: { cryptoId: $wallet.crypto._id }})"
    >
      <template #circle>
        <ReceiveIcon />
      </template>
      {{ $t('Receive') }}
    </CsButton>
  </CsButtonGroup>
</template>

<style lang="scss">
  .#{ $filename } {
    $self: &;

    &__content {
      flex-grow: 1;
    }

    &__actions {
      width: 100%;
      max-width: 25rem;
      align-self: center;
    }
  }
</style>
