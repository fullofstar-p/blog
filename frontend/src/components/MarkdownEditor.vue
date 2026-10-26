<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import { uploadFile } from '@/api/file'
import { toastSuccess } from '@/utils/toast'

/**
 * 正文编辑器：Vditor「即时渲染（IR）」模式。
 *
 * 与原先 md-editor-v3 的左右分栏不同：IR 模式在书写位置直接渲染标题/列表/
 * 代码块等，类似 Typora；工具栏的「编辑模式」按钮可随时切到所见即所得
 * （wysiwyg）或分屏（sv）。图片仍走项目自己的 /api/files/upload。
 *
 * 静态资源（lute / i18n / 图标 / 高亮样式）由 scripts/copy-vditor.mjs 在
 * predev、prebuild 时拷贝到 public/vditor，因此不用外网 CDN。
 */
const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '用 Markdown 写下你的想法…' },
  minHeight: { type: Number, default: 420 }
})

const emit = defineEmits(['update:modelValue'])

const host = ref(null)
let vditor = null

const toolbar = [
  'headings',
  'bold',
  'italic',
  'strike',
  '|',
  'list',
  'ordered-list',
  'check',
  'outdent',
  'indent',
  '|',
  'quote',
  'line',
  'code',
  'inline-code',
  'link',
  'table',
  'upload',
  '|',
  'undo',
  'redo',
  '|',
  'edit-mode',
  'outline',
  'fullscreen'
]

function onInput(value) {
  emit('update:modelValue', value)
}

/** 图片上传：沿用项目接口，上传成功后在光标处插入 Markdown 图片 */
async function uploadImages(files) {
  for (const file of files) {
    try {
      const data = await uploadFile(file, 'content')
      if (data && data.url) {
        vditor.insertValue(`![${file.name || '图片'}](${data.url})`)
        toastSuccess('图片已插入正文')
      }
    } catch (error) {
      console.error('[markdown] 图片上传失败', error)
    }
  }
  return null
}

onMounted(() => {
  vditor = new Vditor(host.value, {
    // 即时渲染：边写边在当前位置渲染 Markdown
    mode: 'ir',
    value: props.modelValue || '',
    height: props.minHeight,
    placeholder: props.placeholder,
    lang: 'zh_CN',
    icon: 'ant',
    theme: 'classic',
    // 本地资源目录（由 scripts/copy-vditor.mjs 生成）
    cdn: '/vditor',
    // 内容以后端为准，不使用 Vditor 的 localStorage 缓存，避免多端编辑串内容
    cache: { enable: false },
    toolbar,
    counter: { enable: true, type: 'markdown' },
    upload: {
      accept: 'image/jpeg,image/png,image/webp,image/gif',
      max: 5 * 1024 * 1024,
      handler: uploadImages
    },
    input: onInput
  })
})

// 外部（编辑已有文章/切换文章）赋值时同步进编辑器；相同内容不重复 setValue
watch(
  () => props.modelValue,
  (value) => {
    if (!vditor) return
    const current = vditor.getValue()
    if ((value || '') !== current) {
      vditor.setValue(value || '', true)
    }
  }
)

onBeforeUnmount(() => {
  if (vditor) {
    vditor.destroy()
    vditor = null
  }
})
</script>

<template>
  <div ref="host" class="vditor-host"></div>
</template>
