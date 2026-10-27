<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import { uploadFile } from '@/api/file'
import { enhanceVditor } from '@/components/vditorEnhance'
import { toastSuccess } from '@/utils/toast'

/**
 * 正文编辑器：Vditor「即时渲染（IR）」模式。
 *
 * 只保留即时渲染，不提供所见即所得 / 分屏切换——写和看是同一片区域，
 * 光标所在位置直接渲染标题、列表、表格、代码块等。
 * 图片仍走项目自己的 /api/files/upload。
 *
 * 工具栏中文名称、表格浮动操作条、大纲跳转与全屏修复在 vditorEnhance.js 中。
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
let disposeEnhance = null

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
    // 工具栏自带字数是按输入事件估算的，不准确；字数统计统一由页面右侧显示
    counter: { enable: false },
    upload: {
      accept: 'image/jpeg,image/png,image/webp,image/gif',
      max: 5 * 1024 * 1024,
      handler: uploadImages
    },
    input: onInput,
    after: () => {
      disposeEnhance = enhanceVditor(vditor)
    }
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
  if (disposeEnhance) {
    disposeEnhance()
    disposeEnhance = null
  }
  if (vditor) {
    vditor.destroy()
    vditor = null
  }
})
</script>

<template>
  <div ref="host" class="vditor-host"></div>
</template>
