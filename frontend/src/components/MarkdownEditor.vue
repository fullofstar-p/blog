<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Vditor from 'vditor'
import 'vditor/dist/index.css'
import { uploadFile } from '@/api/file'
import { enhanceVditor } from '@/components/vditorEnhance'
import {
  MENUS,
  activeHeadingIndex,
  canExitSourceFast,
  getMode,
  isMac,
  parseHeadings,
  runCommand,
  scrollToHeading,
  toggleSourceMode
} from '@/components/typoraChrome'
import {
  IMPORT_ACCEPT,
  buildExportHtml,
  dateStamp,
  downloadText,
  firstHeading,
  highlightHtml,
  isMarkdownFile,
  normalizeImportText,
  sanitizeFileName,
  suggestTitle
} from '@/components/markdownIO'
import { exportMarkdownPdf } from '@/components/markdownPdf'
import { toastError, toastSuccess } from '@/utils/toast'
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
  uploadCategory: { type: String, default: 'content' },
  // 导出文件名优先取文章标题（由宿主传入），为空时退回正文第一个标题
  fileName: { type: String, default: '' }
})

const emit = defineEmits(['update:modelValue', 'import-file'])

const MENUBAR_HEIGHT = 36
const STATUSBAR_HEIGHT = 28
const CHROME_HEIGHT = MENUBAR_HEIGHT + STATUSBAR_HEIGHT

const root = ref(null)
const host = ref(null)
const fileInput = ref(null)
const importInput = ref(null)
const dialogPrimary = ref(null)

const openMenu = ref('')
const outlineOpen = ref(false)
// 大纲侧栏第一次打开后才挂载 DOM；之后用 v-show 切换，避免反复销毁/重建几百个标题按钮，
// 也避免侧栏挤占宽度导致整篇大文档重新排版（侧栏改成覆盖在编辑区上方）。
const outlineMounted = ref(false)
const headings = ref([])
const activeHeading = ref(-1)
const isSource = ref(false)
const isFullscreen = ref(false)
// CSS 兜底全屏（浏览器拒绝 Fullscreen API 时使用）
const cssFullscreen = ref(false)
const stats = ref({ words: 0, chars: 0 })
const linkDialog = reactive({ open: false, text: '', url: '' })
// 导入 / 新建的确认对话框（导入时还要在「替换正文」和「插入到光标处」之间选）
const ioDialog = reactive({ open: false, kind: '', fileName: '', title: '' })
// 长文档导入 / 切换视图 / 生成 PDF 时的遮罩提示（这些操作会阻塞主线程）
const busy = reactive({ active: false, text: '' })

let vditor = null
let disposeEnhance = null
let ready = false
let unmounted = false
let outlineTimer = 0
let statsTimer = 0
let headingFrame = 0
// 大纲侧栏关闭时只记一个 dirty 标记，等打开时再解析标题，避免每次输入都重建大纲数据
let outlineDirty = false
// 一份最新的 Markdown 文本缓存：Vditor 的 getValue() 在大文档下要序列化整棵 IR DOM
// （十几万字约 0.8s），输入 / 大纲 / 字数都改用缓存，避免每次输入都重新序列化。
let latestMarkdown = props.modelValue || ''
// 等待用户确认导入方式的文件内容（{ content, fileName, title }）
let pendingImport = null
// 进入源码模式时的正文快照：退出时只有内容和它一致才能复用现有 IR DOM
let sourceSnapshot = null

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
  latestMarkdown = typeof value === 'string' ? value : ''
  emit('update:modelValue', latestMarkdown)
  scheduleStats()
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
  const source = typeof value === 'string' ? value : latestMarkdown
  const next = countArticle(source || '')
  stats.value = { words: next.words, chars: next.chars }
}

/** 字数统计要跑十几条正则，大文档下不必每个按键都算，停顿后再更新状态栏 */
function scheduleStats(delay = 180) {
  window.clearTimeout(statsTimer)
  statsTimer = window.setTimeout(() => {
    statsTimer = 0
    applyStats()
  }, delay)
}

/** 标题列表没变化时不替换数组，避免输入时让侧栏的几百个按钮全部重新渲染 */
function headingsEqual(left, right) {
  if (left.length !== right.length) return false
  for (let index = 0; index < left.length; index += 1) {
    const a = left[index]
    const b = right[index]
    if (a.level !== b.level || a.text !== b.text || a.line !== b.line) return false
  }
  return true
}

function refreshOutline() {
  outlineTimer = 0
  if (!vditor) return
  const next = parseHeadings(latestMarkdown)
  outlineDirty = false
  if (headingsEqual(headings.value, next)) return
  headings.value = next
  if (!next.length) activeHeading.value = -1
}

function scheduleOutline(delay = 180) {
  window.clearTimeout(outlineTimer)
  outlineTimer = window.setTimeout(() => {
    outlineTimer = 0
    if (outlineOpen.value) refreshOutline()
    else outlineDirty = true
  }, delay)
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
  const mode = getMode(vditor)
  isSource.value = mode === 'sv'
  // 源码模式的内容就是 textarea.value，读取很便宜；顺手同步成 Vditor 规范化后的文本
  if (vditor && mode === 'sv') latestMarkdown = vditor.getValue()
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
  if (cmd === 'new') {
    newDocument()
    return
  }
  if (cmd === 'import') {
    pickImportFile()
    return
  }
  if (cmd === 'export-md') {
    exportMarkdown()
    return
  }
  if (cmd === 'export-html') {
    exportHtml()
    return
  }
  if (cmd === 'export-pdf') {
    exportPdf()
    return
  }
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

/* ---------------------------------------------------------------------------
 * 文件菜单：新建 / 导入 Markdown / 导出 Markdown / 导出 HTML / 导出 PDF（打印）
 * 导入导出全在前端完成，不调用后端接口；语法与 Typora 的「文件」菜单一致。
 * ------------------------------------------------------------------------- */

function currentMarkdown() {
  // 用缓存而不是 vditor.getValue()：大文档序列化要 0.8s 左右，导入判空/导出都应即时返回
  return latestMarkdown
}

function isBlankMarkdown(value) {
  return !String(value || '').trim()
}

/** 等一帧真正绘制完成：长任务开始前先让遮罩提示显示出来，避免「点了没反应」 */
const nextFrame = () =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

function focusDialogPrimary() {
  if (dialogPrimary.value) dialogPrimary.value.focus()
}

function openIoDialog(kind) {
  ioDialog.kind = kind
  ioDialog.open = true
  nextTick(focusDialogPrimary)
}

/** 新建：正文为空时直接清空，非空先让用户确认，避免误删 */
function newDocument() {
  if (!vditor) return
  if (isBlankMarkdown(currentMarkdown())) {
    applyNewDocument()
    return
  }
  ioDialog.fileName = ''
  ioDialog.title = ''
  openIoDialog('new')
}

function applyNewDocument() {
  if (!vditor) return
  ioDialog.open = false
  pendingImport = null
  vditor.setValue('')
  latestMarkdown = ''
  window.clearTimeout(statsTimer)
  applyStats('')
  onInput('')
  vditor.focus()
  toastSuccess('已新建空白文档')
}

/** Ctrl+O / 「文件 → 导入」都走这里：打开系统文件选择框 */
function pickImportFile() {
  if (importInput.value) importInput.value.click()
}

async function onImportFileChange(event) {
  const files = Array.from((event.target && event.target.files) || [])
  if (event.target) event.target.value = ''
  if (files.length) await handleImportFile(files[0])
}

/** 读取并规范化 Markdown 文件，再决定直接导入还是先问「替换 / 插入」 */
async function handleImportFile(file) {
  if (!file) return
  if (!isMarkdownFile(file)) {
    toastError('请选择 Markdown 文件（.md / .markdown / .txt）')
    return
  }
  if (file.size > 5 * 1024 * 1024) {
    toastError('文件超过 5MB，请拆分后再导入')
    return
  }
  let text = ''
  try {
    text = normalizeImportText(await file.text())
  } catch (error) {
    console.error('[markdown] 读取导入文件失败', error)
    toastError('文件读取失败，请换一个文件再试')
    return
  }
  if (isBlankMarkdown(text)) {
    toastError('这个文件是空的，没有可导入的内容')
    return
  }
  pendingImport = {
    content: text,
    fileName: file.name || 'markdown.md',
    title: suggestTitle(text, file.name)
  }
  if (isBlankMarkdown(currentMarkdown())) {
    applyImport('replace')
    return
  }
  ioDialog.fileName = pendingImport.fileName
  ioDialog.title = pendingImport.title
  openIoDialog('import')
}

/** 应用导入：replace 覆盖正文（仍可撤销），insert 插入到当前光标处 */
async function applyImport(mode) {
  if (!vditor || !pendingImport || busy.active) return
  const { content, fileName, title } = pendingImport
  pendingImport = null
  ioDialog.open = false
  busy.active = true
  busy.text = '正在导入 Markdown…'
  await nextTick()
  await nextFrame()
  try {
    if (mode === 'insert') {
      vditor.insertMD(content)
      latestMarkdown = vditor.getValue()
    } else {
      // 直接用读入的文本作为正文，不再把整棵 IR DOM 序列化回 Markdown。
      // 十几万字的文档 getValue() 要 0.8s 左右，导入阶段本来就要渲染一次，能省则省。
      vditor.setValue(content, false)
      latestMarkdown = content
    }
  } finally {
    busy.active = false
  }
  window.clearTimeout(statsTimer)
  applyStats()
  emit('update:modelValue', latestMarkdown)
  emit('import-file', { mode, fileName, title })
  scheduleOutline(60)
  vditor.focus()
  toastSuccess(mode === 'insert' ? `已插入 ${fileName}` : `已导入 ${fileName}`)
}

function closeIoDialog() {
  ioDialog.open = false
  pendingImport = null
  if (vditor) vditor.focus()
}

/** 导出文件名：文章标题 → 正文第一个标题 → 日期 */
function exportBaseName() {
  const fromProp = String(props.fileName || '').trim()
  if (fromProp) return sanitizeFileName(fromProp)
  const heading = firstHeading(currentMarkdown())
  if (heading) return sanitizeFileName(heading)
  return sanitizeFileName(`未命名文档-${dateStamp()}`, '未命名文档')
}

function exportTitle() {
  const fromProp = String(props.fileName || '').trim()
  if (fromProp) return fromProp
  return firstHeading(currentMarkdown()) || exportBaseName()
}

/** Markdown → HTML（用编辑器内部已就绪的 lute，不额外加载脚本），再补代码高亮 */
function exportBodyHtml() {
  const internal = vditor && vditor.vditor
  const markdown = currentMarkdown()
  if (!internal || !internal.lute || typeof internal.lute.Md2HTML !== 'function') return ''
  try {
    return highlightHtml(internal.lute.Md2HTML(markdown))
  } catch (error) {
    console.warn('[markdown] 导出 HTML 渲染失败', error)
    return ''
  }
}

function exportMarkdown() {
  if (!vditor) return
  const name = exportBaseName()
  downloadText(`${name}.md`, currentMarkdown(), 'text/markdown;charset=utf-8')
  toastSuccess(`已导出 ${name}.md`)
}

function exportHtml() {
  if (!vditor) return
  const name = exportBaseName()
  const html = buildExportHtml({ title: exportTitle(), bodyHtml: exportBodyHtml() })
  downloadText(`${name}.html`, html, 'text/html;charset=utf-8')
  toastSuccess(`已导出 ${name}.html`)
}

/** PDF 和 Markdown/HTML 一样直接下载：浏览器端分页渲染后生成 pdf 文件 */
async function exportPdf() {
  if (!vditor || busy.active) return
  const name = exportBaseName()
  const bodyHtml = exportBodyHtml()
  if (!bodyHtml.trim()) {
    toastError('正文为空，暂时没有可导出的内容')
    return
  }
  busy.active = true
  busy.text = '正在生成 PDF…'
  await nextTick()
  await nextFrame()
  try {
    const pages = await exportMarkdownPdf({
      bodyHtml,
      title: exportTitle(),
      fileName: `${name}.pdf`,
      onProgress: (page, total) => {
        busy.text = `正在生成 PDF（${page}/${total} 页）…`
      }
    })
    toastSuccess(`已导出 ${name}.pdf（${pages} 页）`)
  } catch (error) {
    console.error('[markdown] 导出 PDF 失败', error)
    toastError((error && error.message) || 'PDF 生成失败，请稍后再试')
  } finally {
    busy.active = false
  }
}

/**
 * 拖拽 .md 文件到编辑器直接导入。
 * 用捕获阶段先判断是不是 Markdown 文件：是就拦下（Vditor 只处理图片/HTML 拖入），
 * 不是就放行，图片拖拽上传仍然由 Vditor 自己处理。
 */
function onEditorDragOver(event) {
  const transfer = event.dataTransfer
  if (!transfer) return
  const types = Array.from(transfer.types || [])
  if (!types.includes('Files')) return
  event.preventDefault()
  transfer.dropEffect = 'copy'
}

function onEditorDrop(event) {
  const transfer = event.dataTransfer
  if (!transfer) return
  const files = Array.from(transfer.files || [])
  const file = files.find(isMarkdownFile)
  if (!file) return
  event.preventDefault()
  event.stopPropagation()
  handleImportFile(file)
}

function toggleMenu(key) {
  openMenu.value = openMenu.value === key ? '' : key
}

function closeMenus() {
  openMenu.value = ''
}

function toggleOutline() {
  outlineOpen.value = !outlineOpen.value
  if (!outlineOpen.value) return
  outlineMounted.value = true
  if (outlineDirty || !headings.value.length) refreshOutline()
  nextTick(scheduleActiveHeading)
}

/** 点击正文（编辑区）时自动收起大纲，避免覆盖式侧栏挡住刚点的位置 */
function onSurfaceClick(event) {
  if (!outlineOpen.value) return
  const target = event.target
  if (target && target.closest && target.closest('.typora-editor__sidebar')) return
  outlineOpen.value = false
}

function gotoHeading(index) {
  if (!vditor) return
  const heading = headings.value[index]
  if (!heading) return
  // 只滚动，不 focus：focus 会先把光标（常在文末）滚进可视区，看起来像先跳到底部
  activeHeading.value = index
  scrollToHeading(vditor, index, heading.line)
}

async function toggleSource() {
  if (!vditor || busy.active) return
  const toSource = getMode(vditor) !== 'sv'
  const finishSwitch = () => {
    if (toSource) sourceSnapshot = latestMarkdown
    else sourceSnapshot = null
  }

  // 源码没改过：让 Vditor 正常切回（模式/焦点/撤销栈状态都由它维护），
  // 但跳过重建整篇 IR DOM，所以不会卡；快速路径失败时继续走普通切换。
  if (!toSource && canExitSourceFast(vditor, sourceSnapshot)) {
    if (toggleSourceMode(vditor, latestMarkdown, { reuseIrDom: true })) {
      handleModeChange()
      sourceSnapshot = null
      vditor.focus()
      return
    }
  }

  // 小文档切换很快，不需要遮罩（遮罩本身要等两帧）
  if (latestMarkdown.length < 30000) {
    if (toggleSourceMode(vditor, latestMarkdown)) {
      handleModeChange()
      finishSwitch()
    }
    vditor.focus()
    return
  }

  busy.active = true
  busy.text = toSource ? '正在打开源码模式…' : '正在切回即时渲染…'
  await nextTick()
  await nextFrame()
  try {
    if (toggleSourceMode(vditor, latestMarkdown)) {
      handleModeChange()
      finishSwitch()
    }
  } finally {
    busy.active = false
  }
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
  cssFullscreen.value = on
  isFullscreen.value = on
  if (on) element.classList.add('typora-editor--fullscreen')
  else element.classList.remove('typora-editor--fullscreen')
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
  if (document.fullscreenElement === element) {
    if (document.exitFullscreen) document.exitFullscreen()
    return
  }
  if (cssFullscreen.value) {
    setCssFullscreen(element, false)
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
    // 原生全屏接管：清掉 CSS 兜底状态，避免退出后残留 fixed/flex 布局
    isFullscreen.value = true
    if (cssFullscreen.value) {
      cssFullscreen.value = false
      if (element) element.classList.remove('typora-editor--fullscreen')
    }
    document.body.style.overflow = ''
    restoreAncestors()
  } else if (cssFullscreen.value) {
    // 正在用 CSS 兜底全屏，保持状态
    isFullscreen.value = true
  } else {
    isFullscreen.value = false
  }
  resizeEditor()
}

/** 快捷键：对齐 Typora（标题 Ctrl+1~6、正文 Ctrl+0、链接 Ctrl+K、源码 Ctrl+/、导入 Ctrl+O、新建 Ctrl+N） */
function onKeydown(event) {
  const mod = isMac() ? event.metaKey : event.ctrlKey
  if (!mod || event.altKey) return
  // 对话框打开时不接管快捷键，避免和输入框/按钮自己的键盘操作冲突
  if (ioDialog.open || linkDialog.open) return
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
  if (key === 'o' || key === 'O') {
    event.preventDefault()
    pickImportFile()
    return
  }
  if (key === 'n' || key === 'N') {
    event.preventDefault()
    newDocument()
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
    if (ioDialog.open) closeIoDialog()
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
  // 拖放导入：捕获阶段先于 Vditor 的 drop 处理，只拦 Markdown 文件
  if (root.value) {
    root.value.addEventListener('dragover', onEditorDragOver, true)
    root.value.addEventListener('drop', onEditorDrop, true)
  }
})

// 外部（编辑已有文章/切换文章）赋值时同步进编辑器；相同内容不重复 setValue
watch(
  () => props.modelValue,
  (value) => {
    const next = value || ''
    if (!vditor || !ready) {
      latestMarkdown = next
      applyStats(next)
      return
    }
    // 自己 emit 出去的值（输入/导入）直接忽略：不能再调 getValue() 序列化整篇文档
    if (next === latestMarkdown) return
    latestMarkdown = next
    vditor.setValue(next, true)
    window.clearTimeout(statsTimer)
    applyStats(next)
    scheduleOutline(120)
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
  if (root.value) {
    root.value.removeEventListener('dragover', onEditorDragOver, true)
    root.value.removeEventListener('drop', onEditorDrop, true)
  }
  window.clearTimeout(outlineTimer)
  window.clearTimeout(statsTimer)
  if (headingFrame) window.cancelAnimationFrame(headingFrame)
  // 组件卸载时如果还处于 CSS 兜底全屏，恢复页面滚动与祖先样式
  if (cssFullscreen.value) setCssFullscreen(root.value, false)
  destroyVditor()
})
</script>

<template>
  <div
    ref="root"
    class="typora-editor"
    :class="{ 'typora-editor--fullscreen': cssFullscreen }"
    :aria-busy="busy.active ? 'true' : 'false'"
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
      <aside v-if="outlineMounted" v-show="outlineOpen" class="typora-editor__sidebar">
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

      <div class="typora-editor__surface" @click.capture="onSurfaceClick">
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

        <div
          v-if="ioDialog.open"
          class="typora-editor__dialog"
          role="dialog"
          aria-modal="true"
          :aria-label="ioDialog.kind === 'import' ? '导入 Markdown' : '新建空白文档'"
        >
          <template v-if="ioDialog.kind === 'import'">
            <p class="typora-editor__dialog-title">导入 Markdown</p>
            <p class="typora-editor__dialog-desc">
              已读取 <strong>{{ ioDialog.fileName }}</strong>。当前正文不为空，请选择导入方式：
            </p>
            <p class="typora-editor__dialog-meta">
              识别到的标题：{{ ioDialog.title || '未识别到标题' }}
            </p>
            <div class="typora-editor__dialog-actions">
              <button type="button" class="typora-editor__btn" @click="closeIoDialog">取消</button>
              <button type="button" class="typora-editor__btn" @click="applyImport('insert')">
                插入到光标处
              </button>
              <button
                ref="dialogPrimary"
                type="button"
                class="typora-editor__btn typora-editor__btn--primary"
                @click="applyImport('replace')"
              >
                替换正文
              </button>
            </div>
          </template>
          <template v-else>
            <p class="typora-editor__dialog-title">新建空白文档</p>
            <p class="typora-editor__dialog-desc">
              当前正文不为空，新建会清空编辑器里的内容（之后仍可用 Ctrl+Z 撤销）。
            </p>
            <div class="typora-editor__dialog-actions">
              <button type="button" class="typora-editor__btn" @click="closeIoDialog">取消</button>
              <button
                ref="dialogPrimary"
                type="button"
                class="typora-editor__btn typora-editor__btn--primary"
                @click="applyNewDocument"
              >
                清空正文
              </button>
            </div>
          </template>
        </div>

        <div v-if="busy.active" class="typora-editor__busy" role="status" aria-live="polite">
          <span class="typora-editor__busy-spinner" aria-hidden="true"></span>
          <span>{{ busy.text }}</span>
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
    <input
      ref="importInput"
      type="file"
      :accept="IMPORT_ACCEPT"
      class="typora-editor__file"
      @change="onImportFileChange"
    />
  </div>
</template>
