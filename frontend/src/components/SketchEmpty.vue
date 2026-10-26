<script setup>
defineProps({
  title: { type: String, default: '这里还是一片空白' },
  description: { type: String, default: '换个条件再试试，或者晚点再来看看。' },
  icon: { type: String, default: '✎' }
})
</script>

<template>
  <div
    class="flex flex-col items-center justify-center gap-4 border-2 border-dashed border-pencil/50 bg-paper-soft/60 px-6 py-12 text-center"
  >
    <span
      class="inline-flex h-16 w-16 rotate-[-2deg] items-center justify-center border-2 border-dashed border-pencil/60 font-serif text-3xl italic text-pencil-faint"
      aria-hidden="true"
    >
      {{ icon }}
    </span>
    <h2 class="font-serif text-xl italic text-pencil md:text-2xl">{{ title }}</h2>
    <p class="max-w-md font-serif text-sm leading-relaxed text-ink-500">{{ description }}</p>
    <slot />
  </div>
</template>
