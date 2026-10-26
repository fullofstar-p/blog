<script setup>
import { computed } from 'vue'

const props = defineProps({
  rows: { type: Number, default: 3 },
  label: { type: String, default: '正在加载' }
})

// 交替宽度，模拟手绘草稿的段落长度
const widths = ['w-11/12', 'w-9/12', 'w-10/12', 'w-7/12', 'w-8/12', 'w-5/12']

const items = computed(() => Array.from({ length: Math.max(1, props.rows) }, (_, index) => index))
</script>

<template>
  <div class="flex flex-col gap-4" role="status" :aria-label="label" aria-busy="true">
    <span class="sr-only">{{ label }}</span>
    <div
      v-for="(_, index) in items"
      :key="index"
      class="sketch-card space-y-3 p-5"
      :class="index % 2 === 0 ? 'rotate-[-0.2deg]' : 'rotate-[0.2deg]'"
    >
      <div class="sketch-skeleton h-5 w-8/12"></div>
      <div class="sketch-skeleton h-3" :class="widths[index % widths.length]"></div>
      <div class="sketch-skeleton h-3 w-6/12"></div>
    </div>
  </div>
</template>
