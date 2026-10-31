<script setup>
import { computed } from 'vue'

const props = defineProps({
  category: { type: Object, required: true },
  clickable: { type: Boolean, default: true },
  active: { type: Boolean, default: false }
})

const classList = computed(() => [
  'inline-flex min-h-[44px] items-center gap-1.5 border-2 border-dashed px-3 py-2 font-serif text-sm italic shadow-sketchsm transition-colors duration-150',
  props.active
    ? 'border-pencil bg-pencil text-paper'
    : 'border-pencil/60 bg-paper text-pencil hover:bg-pencil hover:text-paper',
  props.clickable ? 'active:translate-x-[1px] active:translate-y-[1px] active:shadow-press' : ''
])
</script>

<template>
  <RouterLink
    v-if="clickable"
    :to="{ name: 'category', params: { id: category.id } }"
    :class="classList"
  >
    <span class="text-sketchred" aria-hidden="true">◈</span>
    {{ category.name }}
    <span v-if="category.articleCount !== undefined && category.articleCount !== null" class="text-xs opacity-70">
      {{ category.articleCount }}
    </span>
  </RouterLink>
  <span v-else :class="classList">
    <span class="text-sketchred" aria-hidden="true">◈</span>
    {{ category.name }}
  </span>
</template>
