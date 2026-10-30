<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { uploadFile } from '@/api/file'
import { formatSize } from '@/utils/format'
import { toastSuccess } from '@/utils/toast'

const props = defineProps({
  modelValue: { type: String, default: '' },
  category: { type: String, default: 'cover' },
  label: { type: String, default: '' },
  hint: { type: String, default: '' },
  accept: { type: String, default: 'image/jpeg,image/png,image/webp,image/gif' },
  maxSizeMB: { type: Number, default: 5 },
  disabled: { type: Boolean, default: false },
  previewClass: { type: String, default: 'max-h-56' }
})

const emit = defineEmits(['update:modelValue', 'uploaded', 'removed'])

const inputRef = ref(null)
const uploading = ref(false)
const progress = ref(0)
const error = ref('')
const dragActive = ref(false)
const pendingFile = ref(null)
const localPreview = ref('')

const previewSrc = computed(() => localPreview.value || props.modelValue || '')

const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'gif']

const fileMeta = computed(() => {
  if (!pendingFile.value) return ''
  return `${pendingFile.value.name} · ${formatSize(pendingFile.value.size)}`
})

watch(
  () => props.modelValue,
  (value) => {
    // 外部清空时同步清掉本地预览
    if (!value && localPreview.value) {
      URL.revokeObjectURL(localPreview.value)
      localPreview.value = ''
    }
  }
)

onBeforeUnmount(() => {
  if (localPreview.value) URL.revokeObjectURL(localPreview.value)
})

function pick() {
  if (props.disabled || uploading.value) return
  if (inputRef.value) inputRef.value.click()
}

function validate(file) {
  const ext = (file.name.split('.').pop() || '').toLowerCase()
  if (!allowedTypes.includes(file.type) && !allowedExts.includes(ext)) {
    error.value = '仅支持 jpg / png / webp / gif 格式的图片'
    return false
  }
  if (file.size > props.maxSizeMB * 1024 * 1024) {
    error.value = `图片不能超过 ${props.maxSizeMB}MB`
    return false
  }
  return true
}

function onChange(event) {
  const file = event.target.files && event.target.files[0]
  if (event.target) event.target.value = ''
  if (file) startUpload(file)
}

function onDrop(event) {
  dragActive.value = false
  if (props.disabled || uploading.value) return
  const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]
  if (file) startUpload(file)
}

function onDragOver() {
  if (!props.disabled && !uploading.value) dragActive.value = true
}

async function startUpload(file) {
  error.value = ''
  if (!validate(file)) return
  pendingFile.value = file
  if (localPreview.value) URL.revokeObjectURL(localPreview.value)
  localPreview.value = URL.createObjectURL(file)
  uploading.value = true
  progress.value = 0
  try {
    const data = await uploadFile(file, props.category, (percent) => {
      progress.value = Math.max(progress.value, Math.min(100, percent))
    })
    progress.value = 100
    emit('update:modelValue', data.url)
    emit('uploaded', data)
    toastSuccess('图片上传成功')
    pendingFile.value = null
  } catch (uploadError) {
    error.value = (uploadError && uploadError.message) || '上传失败，请重试'
  } finally {
    uploading.value = false
  }
}

function retry() {
  if (pendingFile.value) startUpload(pendingFile.value)
}

function remove() {
  if (uploading.value) return
  if (localPreview.value) URL.revokeObjectURL(localPreview.value)
  localPreview.value = ''
  pendingFile.value = null
  error.value = ''
  progress.value = 0
  emit('update:modelValue', '')
  emit('removed')
}

defineExpose({ pick, remove })
</script>

<template>
  <div class="w-full">
    <p v-if="label" class="sketch-label">{{ label }}</p>

    <div
      class="relative border-2 border-dashed bg-paper-soft/60 p-3 transition-all duration-150"
      :class="[
        dragActive ? 'rotate-[-0.4deg] border-pencil bg-pencil/5 shadow-sketch' : 'border-pencil/60',
        disabled ? 'opacity-60' : ''
      ]"
      @dragover.prevent="onDragOver"
      @dragleave.prevent="dragActive = false"
      @drop.prevent="onDrop"
    >
      <input
        ref="inputRef"
        type="file"
        class="sr-only"
        :accept="accept"
        :disabled="disabled || uploading"
        aria-label="选择图片文件"
        @change="onChange"
      />

      <div v-if="previewSrc" class="flex flex-col items-center gap-3">
        <img
          :src="previewSrc"
          alt="已上传图片预览"
          class="w-full rotate-[-0.4deg] border-2 border-dashed border-pencil/60 object-contain shadow-sketchsm"
          :class="previewClass"
        />
        <div class="flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            class="sketch-btn sketch-btn-sm min-h-[44px] px-3 text-sm"
            :disabled="disabled || uploading"
            @click="pick"
          >
            更换图片
          </button>
          <button
            type="button"
            class="sketch-btn sketch-btn-danger sketch-btn-sm min-h-[44px] px-3 text-sm"
            :disabled="disabled || uploading"
            @click="remove"
          >
            移除
          </button>
        </div>
      </div>

      <div v-else class="flex flex-col items-center gap-2 px-2 py-8 text-center">
        <span
          class="inline-flex h-12 w-12 rotate-[-2deg] items-center justify-center border-2 border-dashed border-pencil/60 font-serif text-2xl italic text-pencil-faint"
          aria-hidden="true"
        >
          ⇪
        </span>
        <p class="font-serif text-sm italic text-ink-700">点击选择图片，或拖拽到这里</p>
        <p class="font-serif text-xs italic text-ink-300">
          支持 jpg / png / webp / gif，不超过 {{ maxSizeMB }}MB
        </p>
        <button
          type="button"
          class="sketch-btn sketch-btn-sm min-h-[44px] px-4 text-sm"
          :disabled="disabled || uploading"
          @click="pick"
        >
          选择文件
        </button>
      </div>

      <div v-if="uploading" class="mt-3">
        <div class="h-3 w-full border-2 border-dashed border-pencil/60 bg-paper">
          <div
            class="h-full bg-pencil transition-[width] duration-150"
            :style="{ width: `${progress}%` }"
            role="progressbar"
            :aria-valuenow="progress"
            aria-valuemin="0"
            aria-valuemax="100"
            aria-label="上传进度"
          ></div>
        </div>
        <p class="mt-1 font-serif text-xs italic text-ink-500">
          上传中 {{ progress }}%<span v-if="fileMeta"> · {{ fileMeta }}</span>
        </p>
      </div>

      <div
        v-if="error"
        class="mt-3 flex flex-col gap-2 border-t border-dashed border-pencil/40 pt-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <p class="font-serif text-sm italic text-sketchred" role="alert">{{ error }}</p>
        <button
          v-if="pendingFile"
          type="button"
          class="sketch-btn sketch-btn-sm min-h-[44px] px-3 text-sm"
          @click="retry"
        >
          重试上传
        </button>
      </div>

      <p v-if="hint" class="mt-2 font-serif text-xs italic text-ink-300">{{ hint }}</p>
    </div>
  </div>
</template>
