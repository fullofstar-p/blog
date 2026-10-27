<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import { uploadFile } from '@/api/file'
import { enhanceVditor } from '@/components/vditorEnhance'
import {
  MENUS,
  activeHeadingIndex,
  getMode,
  isMac,
  parseHeadings,
  runCommand,
  scrollToHeading,
  toggleSourceMode
} from '@/components/typoraChrome'
import { toastSuccess } from '@/utils/toast'
import { countArticle } from '@/utils/wordCount'

/**
 * 正文编辑器：Vditor「即时渲染（IR）」内核 + Typora 式外壳。
 *
 * 交互与 Typora 对齐：
 * - 没有一排图标工具栏，改成顶部菜单「段落 / 格式 / 编辑 / 视图」；
 * - 视图菜单可在左侧打开「大纲」、切换「源码模式」（IR ↔ SV）、全屏；
 * - 底部状态栏显示当前模式与字数；表格旁浮出插入/删除行列与删除表格的图标条；
 * - 加粗/斜体/链接等快捷键沿用 Typora（Ctrl+B / Ctrl+I / Ctrl+K / Ctrl+/）。
 *
 * 菜单命令统一委托给 typoraChrome.js，内部点击 Vditor 自己的隐藏按钮，
 * 这样 Markdown 语法处理、撤销栈、选区行为仍是 Vditor 原生实现；
 * 表格操作条、行号、代码块语言角标在 vditorEnhance.js 中。
 * 静态资源由 scripts/copy-vditor.mjs 拷贝到 public/vditor，离线可用。
 */
const props = defineProps({
  modelValue: { type: String, default: '' },
  placeholder: { type: String, default: '用 Markdown 写下你的想法…' },
  minHeight: { type: Number, default: 420 },
  uploadCategory: { type: String, default: 'content' }
})

const emit = defineEmits(['update:modelValue'])

const MENUBAR_HEIGHT = 36
const STATUSBAR_HEIGHT = 28
const CHROME_HEIGHT = MENUBAR_HEIGHT + STATUSBAR_HEIGHT

const root = ref(null)
const host = ref(null)
const fileInput = ref(null)

const openMenu = ref('')
const outlineOpen = ref(false)
const headings = ref([])
const activeHeading = ref(-1)
const isSource = ref(false)
const isFullscreen = ref(false)
const stats = ref({ words: 0, chars: 0 })
const linkDialog = reactive({ open: false, text: '', url: '' })

let vditor = null
let disposeEnhance = null
let ready = false
let unmounted = false
let outlineTimer = 0
let headingFrame = 0

// 工具栏配置保留（元素、快捷键、命令都在），整条工具栏由 CSS 隐藏，交互走顶部菜单
const toolbar = [
  'headings',
  'bold',
  'italic',
  'strike',
  'list',
  'ordered-list',
  'check',
  'outdent',
  'indent',
  'quote',
  'line',
  'code',
  'inline-code',
  'table',
  'undo',
  'redo',
  'edit-mode'
]

const menus = computed(() =>
  MENUS.map((menu) => ({
    ...menu,
    items: menu.items.map((item) => ({
      ...item,
      hint: item.hint ? `${isMac() ? '⌘' : 'Ctrl+'}${item.hint}` : ''
    }))
  }))
)

const modeLabel = computed(() => (isSource.value ? '源码模式' : '即时渲染'))
const editorHeight = computed(() => Math.max(props.minHeight - CHROME_HEIGHT, 260))

function onInput(value) {
  emit('update:modelValue', value)
  applyStats(value)
  scheduleOutline()
}

/** 图片上传：沿用项目接口，上传成功后在光标处插入 Markdown 图片 */
async function uploadImages(files) {
  for (const file of files) {
    try {
      const data = await uploadFile(file, props.uploadCategory)
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

function applyStats(value) {
  const source = typeof value === 'string' ? value : props.modelValue
  const next = countArticle(source || '')
  stats.value = { words: next.words, chars: next.chars }
}

function refreshOutline() {
  outlineTimer = 0
  if (!vditor) return
  headings.value = parseHeadings(vditor.getValue())
  if (!headings.value.length) activeHeading.value = -1
}

function scheduleOutline(delay = 180) {
  window.clearTimeout(outlineTimer)
  outlineTimer = window.setTimeout(refreshOutline, delay)
}

function syncActiveHeading() {
  headingFrame = 0
  if (!outlineOpen.value || !vditor) return
  activeHeading.value = activeHeadingIndex(vditor)
}

function scheduleActiveHeading() {
  if (headingFrame) return
  headingFrame = window.requestAnimationFrame(syncActiveHeading)
}

function handleModeChange() {
  isSource.value = getMode(vditor) === 'sv'
  scheduleOutline(80)
  scheduleActiveHeading()
  // 通知 vditorEnhance 里的表格工具条/行号等按当前模式显隐
  if (vditor && vditor.vditor && vditor.vditor.element) {
    vditor.vditor.element.dispatchEvent(
      new CustomEvent('vditor-mode-change', { detail: getMode(vditor) })
    )
  }
}

/** 菜单命令：宿主相关的几项自己处理，其余交给 Vditor 隐藏按钮 */
function run(cmd) {
  openMenu.value = ''
  if (cmd === 'outline') {
    toggleOutline()
    return
  }
  if (cmd === 'source') {
    toggleSource()
    return
  }
  if (cmd === 'fullscreen') {
    toggleFullscreen()
    return
  }
  if (cmd === 'link') {
    openLinkDialog()
    return
  }
  if (cmd === 'image') {
    fileInput.value && fileInput.value.click()
    return
  }
  if (!vditor) return
  runCommand(vditor, cmd)
  vditor.focus()
  scheduleOutline(260)
}

function toggleMenu(key) {
  openMenu.value = openMenu.value === key ? '' : key
}

function closeMenus() {
  openMenu.value = ''
}

function toggleOutline() {
  outlineOpen.value = !outlineOpen.value
  if (outlineOpen.value) {
    refreshOutline()
    nextTick(scheduleActiveHeading)
  }
}

function gotoHeading(index) {
  if (!vditor) return
  const heading = headings.value[index]
  if (!heading) return
  scrollToHeading(vditor, index, heading.line)
  activeHeading.value = index
  if (!isSource.value) vditor.focus()
}

function toggleSource() {
  if (!vditor) return
  toggleSourceMode(vditor)
  handleModeChange()
  vditor.focus()
}

function openLinkDialog() {
  const selection = window.getSelection()
  linkDialog.text = selection ? selection.toString().trim() : ''
  linkDialog.url = ''
  linkDialog.open = true
  nextTick(() => {
    const input = root.value && root.value.querySelector('.typora-editor__field input')
    if (input) input.focus()
  })
}

function closeLinkDialog() {
  linkDialog.open = false
  if (vditor) vditor.focus()
}

function confirmLink() {
  if (!vditor) return
  const url = linkDialog.url.trim()
  if (!url) {
    closeLinkDialog()
    return
  }
  const text = linkDialog.text.trim() || url
  vditor.insertValue(`[${text}](${url})`)
  linkDialog.open = false
  vditor.focus()
  scheduleOutline(260)
}

function onFileChange(event) {
  const files = Array.from((event.target && event.target.files) || [])
  if (files.length) uploadImages(files)
  if (event.target) event.target.value = ''
}

/**
 * 全屏：优先用浏览器 Fullscreen API（天然铺满视口，祖先 transform 不影响）。
 * 浏览器拒绝时（iframe、权限策略等）退回 CSS 全屏：临时清掉祖先上的
 * transform / filter，否则 position: fixed 会以带变换的卡片为包含块。
 */
let clearedAncestors = []

function clearAncestors(element) {
  clearedAncestors = []
  let node = element.parentElement
  while (node && node !== document.body) {
    const style = getComputedStyle(node)
    if (
      style.transform !== 'none' ||
      style.filter !== 'none' ||
      style.perspective !== 'none' ||
      style.willChange.includes('transform')
    ) {
      clearedAncestors.push({
        node,
        transform: node.style.transform,
        filter: node.style.filter,
        perspective: node.style.perspective,
        willChange: node.style.willChange
      })
      node.style.transform = 'none'
      node.style.filter = 'none'
      node.style.perspective = 'none'
      node.style.willChange = 'auto'
    }
    node = node.parentElement
  }
}

function restoreAncestors() {
  clearedAncestors.forEach(({ node, transform, filter, perspective, willChange }) => {
    node.style.transform = transform
    node.style.filter = filter
    node.style.perspective = perspective
    node.style.willChange = willChange
  })
  clearedAncestors = []
}

function setCssFullscreen(element, on) {
  isFullscreen.value = on
  element.classList.toggle('typora-editor--fullscreen', on)
  document.body.style.overflow = on ? 'hidden' : ''
  if (on) clearAncestors(element)
  else restoreAncestors()
  resizeEditor()
}

function resizeEditor() {
  if (!vditor || typeof vditor.resize !== 'function') return
  window.setTimeout(() => {
    try {
      vditor.resize()
    } catch (error) {
      console.warn('[markdown] 全屏后重排失败', error)
    }
  }, 80)
}

function toggleFullscreen() {
  const element = root.value
  if (!element) return
  if (isFullscreen.value) {
    if (document.fullscreenElement === element && document.exitFullscreen) {
      document.exitFullscreen()
    } else {
      setCssFullscreen(element, false)
    }
    return
  }
  if (element.requestFullscreen) {
    element.requestFullscreen().catch((error) => {
      console.warn('[markdown] 浏览器全屏被拒绝，改用 CSS 全屏', error)
      setCssFullscreen(element, true)
    })
    return
  }
  setCssFullscreen(element, true)
}

function onFullscreenChange() {
  const element = root.value
  const native = Boolean(element && document.fullscreenElement === element)
  if (native) {
    isFullscreen.value = true
    element.classList.remove('typora-editor--fullscreen')
    document.body.style.overflow = ''
    restoreAncestors()
  } else {
    isFullscreen.value = element ? element.classList.contains('typora-editor--fullscreen') : false
  }
  resizeEditor()
}

/** 快捷键：对齐 Typora（标题 Ctrl+1~6、正文 Ctrl+0、链接 Ctrl+K、源码 Ctrl+/） */
function onKeydown(event) {
  const mod = isMac() ? event.metaKey : event.ctrlKey
  if (!mod || event.altKey) return
  const key = event.key
  if (key === '/') {
    event.preventDefault()
    toggleSource()
    return
  }
  if (key === 'k' || key === 'K') {
    event.preventDefault()
    openLinkDialog()
    return
  }
  if (/^[0-6]$/.test(key)) {
    event.preventDefault()
    if (!vditor) return
    runCommand(vditor, key === '0' ? 'paragraph' : `h${key}`)
    vditor.focus()
    scheduleOutline(260)
  }
}

function onDocumentClick(event) {
  if (!openMenu.value) return
  const target = event.target
  if (target && target.closest && target.closest('.typora-editor__menubar')) return
  closeMenus()
}

function onDocumentKeydown(event) {
  if (event.key === 'Escape') {
    openMenu.value = ''
    if (linkDialog.open) {
      linkDialog.open = false
      if (vditor) vditor.focus()
    }
  }
}

/** Vditor 初始化完成：装增强、同步字数与大纲 */
function onReady() {
  ready = true
  if (unmounted) {
    destroyVditor()
    return
  }
  disposeEnhance = enhanceVditor(vditor, { onModeChange: handleModeChange })
  applyStats()
  refreshOutline()
  const internal = vditor.vditor
  if (internal && internal.ir && internal.ir.element) {
    internal.ir.element.addEventListener('scroll', scheduleActiveHeading, { passive: true })
  }
}

/** 卸载时安全销毁：Vditor 初始化未完成时 destroy() 会抛错 */
function destroyVditor() {
  if (disposeEnhance) {
    try {
      disposeEnhance()
    } catch (error) {
      console.warn('[markdown] 增强清理失败', error)
    }
    disposeEnhance = null
  }
  if (!vditor) return
  const instance = vditor
  vditor = null
  try {
    instance.destroy()
  } catch (error) {
    console.warn('[markdown] 编辑器销毁失败', error)
  }
}

onMounted(() => {
  vditor = new Vditor(host.value, {
    mode: 'ir',
    value: props.modelValue || '',
    height: editorHeight.value,
    placeholder: props.placeholder,
    lang: 'zh_CN',
    icon: 'ant',
    theme: 'classic',
    preview: { mode: 'editor' },
    cdn: '/vditor',
    cache: { enable: false },
    counter: { enable: false },
    toolbar,
    toolbarConfig: { hide: true },
    upload: {
      accept: 'image/jpeg,image/png,image/webp,image/gif',
      max: 5 * 1024 * 1024,
      handler: uploadImages
    },
    input: onInput,
    after: onReady
  })
  document.addEventListener('click', onDocumentClick)
  document.addEventListener('keydown', onDocumentKeydown)
  document.addEventListener('fullscreenchange', onFullscreenChange)
})

// 外部（编辑已有文章/切换文章）赋值时同步进编辑器；相同内容不重复 setValue
watch(
  () => props.modelValue,
  (value) => {
    if (!vditor || !ready) {
      applyStats(value)
      return
    }
    const current = vditor.getValue()
    if ((value || '') !== current) {
      vditor.setValue(value || '', true)
      applyStats(value)
      scheduleOutline(120)
    }
  }
)

watch(
  () => outlineOpen.value,
  (open) => {
    if (open) scheduleActiveHeading()
  }
)

onBeforeUnmount(() => {
  unmounted = true
  document.removeEventListener('click', onDocumentClick)
  document.removeEventListener('keydown', onDocumentKeydown)
  document.removeEventListener('fullscreenchange', onFullscreenChange)
  window.clearTimeout(outlineTimer)
  if (headingFrame) window.cancelAnimationFrame(headingFrame)
  // 组件卸载时如果还处于 CSS 兜底全屏，恢复页面滚动与祖先样式
  if (isFullscreen.value) setCssFullscreen(root.value, false)
  destroyVditor()
})
</script>

<template>
  <div
    ref="root"
    class="typora-editor"
    :class="{ 'typora-editor--fullscreen': isFullscreen }"
    @keydown="onKeydown"
  >
    <div class="typora-editor__menubar">
      <div v-for="menu in menus" :key="menu.key" class="typora-editor__menu">
        <button
          type="button"
          class="typora-editor__menu-btn"
          :class="{ 'is-open': openMenu === menu.key }"
          :aria-expanded="openMenu === menu.key ? 'true' : 'false'"
          @mousedown.prevent
          @click.stop="toggleMenu(menu.key)"
        >
          {{ menu.label }}
        </button>
        <div v-if="openMenu === menu.key" class="typora-editor__dropdown" role="menu">
          <template v-for="(item, index) in menu.items" :key="index">
            <div v-if="item.divider" class="typora-editor__divider"></div>
            <button
              v-else
              type="button"
              class="typora-editor__item"
              role="menuitem"
              @mousedown.prevent
              @click.stop="run(item.cmd)"
            >
              <span>{{ item.label }}</span>
              <span v-if="item.hint" class="typora-editor__item-hint">{{ item.hint }}</span>
            </button>
          </template>
        </div>
      </div>

      <div class="typora-editor__tools">
        <button
          type="button"
          class="typora-editor__tool"
          :class="{ 'is-active': outlineOpen }"
          title="显示/隐藏大纲"
          :aria-pressed="outlineOpen ? 'true' : 'false'"
          @click="toggleOutline"
        >
          大纲
        </button>
        <button
          type="button"
          class="typora-editor__tool"
          :class="{ 'is-active': isSource }"
          title="Markdown 源码模式（Ctrl+/）"
          :aria-pressed="isSource ? 'true' : 'false'"
          @click="toggleSource"
        >
          源码
        </button>
        <button type="button" class="typora-editor__tool" title="全屏" @click="toggleFullscreen">
          全屏
        </button>
      </div>
    </div>

    <div class="typora-editor__body" :style="{ height: `${editorHeight}px` }">
      <aside v-if="outlineOpen" class="typora-editor__sidebar">
        <div class="typora-editor__sidebar-head">
          <span>大纲</span>
          <button
            type="button"
            class="typora-editor__sidebar-close"
            title="关闭大纲"
            @click="outlineOpen = false"
          >
            ×
          </button>
        </div>
        <nav class="typora-editor__outline" aria-label="文档大纲">
          <button
            v-for="(heading, index) in headings"
            :key="`${heading.line}-${index}`"
            type="button"
            class="typora-editor__outline-item"
            :class="{ 'is-active': activeHeading === index }"
            :style="{ paddingLeft: `${10 + (heading.level - 1) * 12}px` }"
            :title="heading.text"
            @click="gotoHeading(index)"
          >
            {{ heading.text || '未命名标题' }}
          </button>
          <p v-if="!headings.length" class="typora-editor__outline-empty">还没有标题</p>
        </nav>
      </aside>

      <div class="typora-editor__surface">
        <div ref="host" class="vditor-host"></div>

        <div v-if="linkDialog.open" class="typora-editor__dialog" role="dialog" aria-label="插入链接">
          <p class="typora-editor__dialog-title">插入链接</p>
          <label class="typora-editor__field">
            <span>文本</span>
            <input v-model="linkDialog.text" type="text" placeholder="链接文字" />
          </label>
          <label class="typora-editor__field">
            <span>地址</span>
            <input v-model="linkDialog.url" type="text" placeholder="https://" />
          </label>
          <div class="typora-editor__dialog-actions">
            <button type="button" class="typora-editor__btn" @click="closeLinkDialog">取消</button>
            <button
              type="button"
              class="typora-editor__btn typora-editor__btn--primary"
              @click="confirmLink"
            >
              插入
            </button>
          </div>
        </div>
      </div>
    </div>

    <div class="typora-editor__statusbar">
      <span class="typora-editor__status-item">Markdown</span>
      <span class="typora-editor__status-item">{{ modeLabel }}</span>
      <span class="typora-editor__status-spacer"></span>
      <span class="typora-editor__status-item" :title="`去空白字符数 ${stats.chars}`">{{ stats.words }} 字</span>
    </div>

    <input
      ref="fileInput"
      type="file"
      accept="image/jpeg,image/png,image/webp,image/gif"
      multiple
      class="typora-editor__file"
      @change="onFileChange"
    />
  </div>
</template>
