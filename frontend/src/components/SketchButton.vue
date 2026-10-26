<script setup>
import { computed } from 'vue'

const props = defineProps({
  variant: { type: String, default: 'primary' },
  type: { type: String, default: 'button' },
  loading: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  block: { type: Boolean, default: false }
})

const variantClass = computed(() => {
  if (props.variant === 'ghost') return 'sketch-btn-ghost'
  if (props.variant === 'danger') return 'sketch-btn-danger'
  return 'sketch-btn-primary'
})

const isDisabled = computed(() => props.disabled || props.loading)
</script>

<template>
  <button
    :type="type"
    :disabled="isDisabled"
    class="sketch-btn"
    :class="[variantClass, block ? 'w-full' : '']"
  >
    <span v-if="loading" class="sketch-jitter inline-block" aria-hidden="true">✎</span>
    <slot />
  </button>
</template>
