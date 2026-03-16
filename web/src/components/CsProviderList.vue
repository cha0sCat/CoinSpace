<script>
import CsButton from './CsButton.vue';

export default {
  components: {
    CsButton,
  },
  props: {
    items: {
      type: Array,
      required: true,
    },
    type: {
      type: String,
      default: 'select',
    },
  },
  emits: ['click'],
  computed: {
    buttonType() {
      return this.type === 'select' ? 'primary-light' : '';
    },
    buttonLabel() {
      return this.type === 'select' ? this.$t('Select') : '';
    },
  },
};
</script>

<template>
  <div class="&">
    <div
      v-for="item in items"
      :key="item.id"
      class="&__item"
    >
      <img
        loading="lazy"
        :src="item.logo"
        :alt="item.name"
        class="&__logo"
      >
      <div class="&__content">
        <div
          class="&__title"
          :title="item.name"
        >
          {{ item.name }}
        </div>
        <div
          class="&__subtitle"
          :title="item.description"
        >
          {{ item.description }}
        </div>
      </div>
      <CsButton
        :type="buttonType"
        class="&__action"
        small
        @click="() => $emit('click', item)"
      >
        {{ buttonLabel }}
      </CsButton>
    </div>
  </div>
</template>

<style lang="scss">
  .#{ $filename } {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: $spacing-3xl;

    &__item {
      display: flex;
      align-items: center;
      gap: $spacing-sm;
      overflow-x: hidden;
    }

    &__logo {
      width: 2.75rem;
      height: 2.75rem;
      flex: 0 0 auto;
    }

    &__content {
      flex: 1 1 auto;
      overflow-x: hidden;
    }

    &__title {
      @include text-md;
      @include text-bold;
      @include ellipsis;
    }

    &__subtitle {
      @include text-xs;
      @include ellipsis;
      color: $secondary;
    }
  }
</style>
