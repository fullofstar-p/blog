<script setup>
import { toastState, dismissToast } from '@/utils/toast'

const toneClass = {
  info: 'border-pencil text-pencil',
  success: 'border-sketchgreen text-sketchgreen',
  error: 'border-sketchred text-sketchred'
}

const iconOf = {
  info: '✎',
  success: '✓',
  error: '✕'
}
</script>

<template>
  <div
    class="pointer-events-none fixed inset-x-4 bottom-6 z-50 flex flex-col items-end gap-3 sm:inset-x-auto sm:right-6"
    aria-live="polite"
    aria-atomic="false"
  >
    <div
      v-for="(item, index) in toastState.items"
      :key="item.id"
      class="pointer-events-auto flex w-full max-w-sm items-start gap-3 border-2 border-dashed bg-paper px-4 py-3 shadow-sketch"
      :class="[toneClass[item.type] || toneClass.info, index % 2 === 0 ? 'rotate-[-0.5deg]' : 'rotate-[0.5deg]']"
      role="status"
    >
      <span class="mt-0.5 font-serif text-lg italic" aria-hidden="true">{{ iconOf[item.type] || '✎' }}</span>
      <p class="flex-1 font-serif text-sm leading-relaxed text-pencil">{{ item.message }}</p>
      <button
        type="button"
        class="inline-flex h-11 w-11 shrink-0 items-center justify-center border border-dashed border-pencil/50 text-pencil transition-colors hover:bg-pencil hover:text-paper focus-visible:bg-pencil focus-visible:text-paper"
        aria-label="关闭提示"
        @click="dismissToast(item.id)"
      >
        ✕
      </button>
    </div>
  </div>
</template>
