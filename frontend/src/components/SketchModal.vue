<script setup>
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: '' },
  widthClass: { type: String, default: 'max-w-lg' }
})

const emit = defineEmits(['update:modelValue'])

const panel = ref(null)

function close() {
  emit('update:modelValue', false)
}

function onKeydown(event) {
  if (event.key === 'Escape') close()
}

function lockScroll(locked) {
  document.body.style.overflow = locked ? 'hidden' : ''
}

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      document.addEventListener('keydown', onKeydown)
      lockScroll(true)
      await nextTick()
      if (panel.value) panel.value.focus()
    } else {
      document.removeEventListener('keydown', onKeydown)
      lockScroll(false)
    }
  }
)

onBeforeUnmount(() => {
  document.removeEventListener('keydown', onKeydown)
  lockScroll(false)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-40 flex items-end justify-center bg-overlay/45 p-4 sm:items-center"
      @click.self="close"
    >
      <div
        ref="panel"
        role="dialog"
        aria-modal="true"
        :aria-label="title || '对话框'"
        tabindex="-1"
        class="sketch-card w-full border-2 border-dashed border-pencil bg-paper p-6 shadow-sketch-lg outline-none md:p-8"
        :class="widthClass"
      >
        <div
          class="mb-4 flex items-start justify-between gap-4 border-b border-dashed border-pencil/40 pb-3"
        >
          <h2 class="font-serif text-xl italic text-pencil md:text-2xl">{{ title }}</h2>
          <button
            type="button"
            class="inline-flex h-11 w-11 shrink-0 items-center justify-center border-2 border-dashed border-pencil text-pencil transition-colors duration-150 hover:bg-pencil hover:text-paper active:translate-x-[1px] active:translate-y-[1px]"
            aria-label="关闭对话框"
            @click="close"
          >
            ✕
          </button>
        </div>

        <div class="max-h-[60vh] overflow-y-auto pr-1">
          <slot />
        </div>

        <div v-if="$slots.footer" class="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <slot name="footer" />
        </div>
      </div>
    </div>
  </Teleport>
</template>
