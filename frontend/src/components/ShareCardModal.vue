<script setup>
import { computed, ref, watch } from 'vue'
import SketchButton from '@/components/SketchButton.vue'
import SketchModal from '@/components/SketchModal.vue'
import { getShareCardUrl } from '@/api/article'
import { toastSuccess } from '@/utils/toast'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  article: { type: Object, default: null }
})

const emit = defineEmits(['update:modelValue'])

const imageLoading = ref(true)
const imageError = ref(false)
const retryToken = ref(0)
const copying = ref(false)
const downloading = ref(false)
const actionError = ref('')

const shareUrl = computed(() => (props.article ? getShareCardUrl(props.article.id) : ''))
const previewSrc = computed(() => {
  if (!shareUrl.value) return ''
  return retryToken.value ? `${shareUrl.value}?retry=${retryToken.value}` : shareUrl.value
})
const pageUrl = computed(() =>
  props.article ? `${window.location.origin}/article/${props.article.id}` : ''
)
const shareTitle = computed(() => (props.article && props.article.title) || '技术分享博客')

watch(
  () => props.modelValue,
  (open) => {
    if (!open) return
    imageLoading.value = true
    imageError.value = false
    retryToken.value = 0
    actionError.value = ''
    copying.value = false
    downloading.value = false
  }
)

function close() {
  emit('update:modelValue', false)
}

function onImageLoad() {
  imageLoading.value = false
  imageError.value = false
}

function onImageError() {
  imageLoading.value = false
  imageError.value = true
}

function retryPreview() {
  imageError.value = false
  imageLoading.value = true
  retryToken.value += 1
}

/** 复制文本：优先 Clipboard API，非安全上下文回退到 execCommand */
async function copyText(text) {
  if (navigator.clipboard && (typeof window === 'undefined' || window.isSecureContext)) {
    await navigator.clipboard.writeText(text)
    return
  }
  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  textarea.style.top = '0'
  document.body.appendChild(textarea)
  textarea.select()
  const ok = typeof document.execCommand === 'function' ? document.execCommand('copy') : false
  document.body.removeChild(textarea)
  if (!ok) throw new Error('clipboard unavailable')
}

async function copyLink() {
  if (!pageUrl.value || copying.value) return
  copying.value = true
  actionError.value = ''
  try {
    await copyText(pageUrl.value)
    toastSuccess('文章链接已复制')
  } catch (error) {
    actionError.value = '复制失败，请手动选中链接复制'
    console.warn('[share] 复制失败', error)
  } finally {
    copying.value = false
  }
}

function safeFileName(name) {
  return String(name || 'article')
    .replace(/[\\/:*?"<>|]/g, '-')
    .slice(0, 40)
}

async function downloadCard() {
  if (!shareUrl.value || downloading.value) return
  // TODO(下一轮)：下载前把文章二维码合成到卡片右下角；此处只负责下载服务端 PNG。
  downloading.value = true
  actionError.value = ''
  try {
    const response = await fetch(shareUrl.value, { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(
        response.status === 404 ? '分享卡片不存在（仅已发布文章可生成）' : `下载失败（${response.status}）`
      )
    }
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = `${safeFileName(shareTitle.value)}-分享卡片.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
    URL.revokeObjectURL(objectUrl)
    toastSuccess('分享卡片已开始下载')
  } catch (error) {
    actionError.value = (error && error.message) || '下载失败，请稍后重试'
    console.warn('[share] 下载失败', error)
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <SketchModal
    :model-value="modelValue"
    title="分享这篇文章"
    width-class="max-w-2xl"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <div class="space-y-4">
      <div
        class="relative aspect-[1200/630] w-full overflow-hidden border-2 border-dashed border-pencil/60 bg-paper-deep"
      >
        <div
          v-if="imageLoading"
          class="sketch-skeleton absolute inset-0 z-10 flex items-center justify-center"
          role="status"
        >
          <span class="font-serif text-sm italic text-ink-500">正在生成分享卡片…</span>
        </div>

        <img
          v-if="!imageError"
          :src="previewSrc"
          :alt="`${shareTitle} 的分享卡片预览`"
          class="h-full w-full object-contain"
          @load="onImageLoad"
          @error="onImageError"
        />

        <div
          v-if="imageError"
          class="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center"
        >
          <p class="font-serif text-sm italic text-ink-500">分享卡片暂时不可用</p>
          <p class="font-serif text-xs italic text-ink-300">
            仅已发布文章可生成，或后端服务尚未就绪
          </p>
          <button type="button" class="sketch-btn sketch-btn-sm min-h-[44px] px-3 text-sm" @click="retryPreview">
            重新加载
          </button>
        </div>
      </div>

      <div class="border-2 border-dashed border-pencil/40 bg-paper p-3">
        <p class="font-serif text-xs italic text-ink-300">文章链接</p>
        <p class="mt-1 break-all font-serif text-sm text-ink-700">{{ pageUrl }}</p>
      </div>

      <div class="flex flex-wrap gap-2">
        <SketchButton :loading="copying" @click="copyLink">
          {{ copying ? '复制中…' : '复制链接' }}
        </SketchButton>
        <SketchButton :loading="downloading" @click="downloadCard">
          {{ downloading ? '下载中…' : '下载 PNG' }}
        </SketchButton>
      </div>

      <p
        v-if="actionError"
        class="border-l-2 border-dashed border-sketchred pl-3 font-serif text-sm italic text-sketchred"
        role="alert"
      >
        {{ actionError }}
      </p>
    </div>

    <template #footer>
      <SketchButton variant="ghost" @click="close">关闭</SketchButton>
    </template>
  </SketchModal>
</template>
