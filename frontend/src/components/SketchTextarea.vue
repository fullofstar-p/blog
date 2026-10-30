<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  label: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  error: { type: String, default: '' },
  hint: { type: String, default: '' },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
  rows: { type: Number, default: 4 },
  maxlength: { type: [String, Number], default: undefined }
})

const emit = defineEmits(['update:modelValue'])

const uid = `sk-textarea-${Math.random().toString(36).slice(2, 9)}`
const describedBy = computed(() => {
  if (props.error) return `${uid}-error`
  if (props.hint) return `${uid}-hint`
  return undefined
})

function onInput(event) {
  emit('update:modelValue', event.target.value)
}
</script>

<template>
  <div class="w-full">
    <label v-if="label" :for="uid" class="sketch-label">
      {{ label }}
      <span v-if="required" class="ml-0.5 text-sketchred" aria-hidden="true">*</span>
    </label>

    <textarea
      :id="uid"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :rows="rows"
      :maxlength="maxlength"
      :required="required"
      :aria-invalid="error ? 'true' : 'false'"
      :aria-describedby="describedBy"
      class="sketch-input resize-y leading-relaxed"
      :class="error ? 'sketch-input-error' : ''"
      @input="onInput"
    />

    <p v-if="error" :id="`${uid}-error`" class="mt-1.5 font-serif text-sm italic text-sketchred">
      {{ error }}
    </p>
    <p v-else-if="hint" :id="`${uid}-hint`" class="mt-1.5 font-serif text-xs italic text-ink-300">
      {{ hint }}
    </p>
  </div>
</template>
