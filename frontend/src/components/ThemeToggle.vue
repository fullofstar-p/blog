<script setup>
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useThemeStore } from '@/store/theme'

const theme = useThemeStore()
theme.init()

const open = ref(false)
const root = ref(null)

const options = [
  { value: 'system', label: '跟随系统', desc: '随系统外观自动切换', icon: '◐' },
  { value: 'light', label: '浅色', desc: '米色纸张 + 铅笔灰', icon: '☀' },
  { value: 'dark', label: '深色', desc: '暖黑纸张 + 粉笔白', icon: '☾' }
]

function select(value) {
  theme.setMode(value)
  open.value = false
}

function onDocumentClick(event) {
  if (root.value && !root.value.contains(event.target)) open.value = false
}

function onKeydown(event) {
  if (event.key === 'Escape') open.value = false
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onKeydown)
})
onBeforeUnmount(() => {
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="inline-flex h-11 w-11 items-center justify-center border-2 border-dashed border-pencil text-lg text-pencil transition-colors duration-150 hover:bg-pencil hover:text-paper active:translate-y-[1px]"
      :aria-label="`切换主题，当前${theme.label}`"
      :title="`主题：${theme.label}`"
      aria-haspopup="menu"
      :aria-expanded="open ? 'true' : 'false'"
      @click="open = !open"
    >
      <span aria-hidden="true">{{ theme.isDark ? '☾' : theme.mode === 'system' ? '◐' : '☀' }}</span>
    </button>

    <div
      v-if="open"
      role="menu"
      aria-label="主题设置"
      class="absolute right-0 top-[calc(100%+8px)] z-40 w-56 rotate-[0.3deg] border-2 border-dashed border-pencil bg-paper p-2 shadow-sketch-lg"
    >
      <p class="px-3 pb-1 pt-1 font-serif text-xs italic text-ink-300">主题</p>
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        role="menuitemradio"
        :aria-checked="theme.mode === option.value ? 'true' : 'false'"
        class="group flex min-h-[44px] w-full items-center gap-3 px-3 py-2 text-left font-serif transition-colors hover:bg-pencil hover:text-paper"
        :class="theme.mode === option.value ? 'bg-paper-deep' : ''"
        @click="select(option.value)"
      >
        <span class="w-5 shrink-0 text-center text-base" aria-hidden="true">{{ option.icon }}</span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm italic">{{ option.label }}</span>
          <span class="block text-xs not-italic text-ink-300 group-hover:text-paper/75">
            {{ option.desc }}
          </span>
        </span>
        <span v-if="theme.mode === option.value" aria-hidden="true">✓</span>
      </button>
    </div>
  </div>
</template>
