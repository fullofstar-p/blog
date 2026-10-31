<script setup>
import { computed } from 'vue'

const props = defineProps({
  tag: { type: Object, required: true },
  active: { type: Boolean, default: false },
  clickable: { type: Boolean, default: true },
  size: { type: String, default: 'md' }
})

const classList = computed(() => {
  const base = [
    'inline-flex items-center gap-1 border-2 border-dashed font-serif italic shadow-sketchsm transition-colors duration-150',
    props.active ? 'bg-pencil text-paper border-pencil' : 'border-pencil/60 bg-paper text-pencil'
  ]
  if (props.clickable) {
    base.push('min-h-[44px] min-w-[44px] px-3 py-2 text-sm')
    if (!props.active) base.push('hover:bg-pencil hover:text-paper')
    base.push('active:translate-x-[1px] active:translate-y-[1px] active:shadow-press')
  } else if (props.size === 'sm') {
    base.push('min-h-[32px] px-2 py-0.5 text-xs')
  } else {
    base.push('min-h-[36px] px-2.5 py-1 text-xs')
  }
  return base
})
</script>

<template>
  <RouterLink
    v-if="clickable"
    :to="{ name: 'tag', params: { id: tag.id } }"
    class="group"
    :aria-label="`查看标签 ${tag.name}`"
  >
    <span :class="classList">
      <span class="text-sketchblue" aria-hidden="true">#</span>
      {{ tag.name }}
      <span v-if="tag.articleCount !== undefined && tag.articleCount !== null" class="text-xs opacity-70">
        {{ tag.articleCount }}
      </span>
    </span>
  </RouterLink>
  <span v-else :class="classList">
    <span class="text-sketchblue" aria-hidden="true">#</span>
    {{ tag.name }}
    <span v-if="tag.articleCount !== undefined && tag.articleCount !== null" class="text-xs opacity-70">
      {{ tag.articleCount }}
    </span>
  </span>
</template>
