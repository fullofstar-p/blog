<script setup>
import { computed } from 'vue'

const props = defineProps({
  pageNum: { type: Number, default: 1 },
  total: { type: Number, default: 0 },
  pageSize: { type: Number, default: 10 }
})

const emit = defineEmits(['update:pageNum'])

const totalPages = computed(() => Math.max(1, Math.ceil(props.total / Math.max(1, props.pageSize))))

const pages = computed(() => {
  const last = totalPages.value
  const current = props.pageNum
  if (last <= 7) return Array.from({ length: last }, (_, index) => index + 1)

  const wanted = new Set([1, last, current - 1, current, current + 1])
  const sorted = [...wanted].filter((page) => page >= 1 && page <= last).sort((a, b) => a - b)
  const result = []
  sorted.forEach((page, index) => {
    if (index > 0 && page - sorted[index - 1] > 1) result.push('...')
    result.push(page)
  })
  return result
})

function go(page) {
  if (typeof page !== 'number') return
  if (page < 1 || page > totalPages.value || page === props.pageNum) return
  emit('update:pageNum', page)
}
</script>

<template>
  <nav class="flex flex-col items-center gap-3" aria-label="分页导航">
    <div class="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        class="inline-flex h-11 min-w-[44px] items-center justify-center border-2 border-dashed border-pencil px-3 font-serif text-sm italic text-pencil shadow-sketchsm transition-colors duration-150 hover:bg-pencil hover:text-paper active:translate-x-[1px] active:translate-y-[1px] active:shadow-press disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-paper disabled:hover:text-pencil"
        :disabled="pageNum <= 1"
        aria-label="上一页"
        @click="go(pageNum - 1)"
      >
        ← 上一页
      </button>

      <span
        v-for="(page, index) in pages"
        :key="`${page}-${index}`"
        class="inline-flex"
      >
        <span
          v-if="page === '...'"
          class="inline-flex h-11 min-w-[44px] items-center justify-center font-serif text-pencil-faint"
          aria-hidden="true"
        >
          …
        </span>
        <button
          v-else
          type="button"
          class="inline-flex h-11 min-w-[44px] items-center justify-center border-2 border-dashed px-2 font-serif text-sm italic shadow-sketchsm transition-colors duration-150 hover:bg-pencil hover:text-paper active:translate-x-[1px] active:translate-y-[1px] active:shadow-press"
          :class="page === pageNum ? 'border-pencil bg-pencil text-paper' : 'border-pencil/60 text-pencil'"
          :aria-current="page === pageNum ? 'page' : undefined"
          :aria-label="`第 ${page} 页`"
          @click="go(page)"
        >
          {{ page }}
        </button>
      </span>

      <button
        type="button"
        class="inline-flex h-11 min-w-[44px] items-center justify-center border-2 border-dashed border-pencil px-3 font-serif text-sm italic text-pencil shadow-sketchsm transition-colors duration-150 hover:bg-pencil hover:text-paper active:translate-x-[1px] active:translate-y-[1px] active:shadow-press disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-paper disabled:hover:text-pencil"
        :disabled="pageNum >= totalPages"
        aria-label="下一页"
        @click="go(pageNum + 1)"
      >
        下一页 →
      </button>
    </div>

    <p class="font-serif text-xs italic text-ink-300">
      共 {{ total }} 条 · 第 {{ pageNum }} / {{ totalPages }} 页
    </p>
  </nav>
</template>
