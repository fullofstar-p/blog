<script setup>
defineProps({
  as: { type: String, default: 'div' },
  hoverable: { type: Boolean, default: false },
  tilted: { type: Boolean, default: false },
  padded: { type: Boolean, default: true }
})
</script>

<template>
  <component
    :is="as"
    class="sketch-card"
    :class="[
      hoverable ? 'sketch-card-hover' : '',
      tilted ? 'rotate-[-0.4deg]' : '',
      padded ? 'p-6 md:p-8' : ''
    ]"
  >
    <slot />
  </component>
</template>
