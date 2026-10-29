/**
 * Typora 式编辑器外壳的纯逻辑：菜单定义、命令派发、大纲解析与滚动定位。
 *
 * 设计要点：
 * - Vditor 自带的工具栏配置仍然保留（按钮元素存在、快捷键与命令逻辑都在），
 *   但整条工具栏在 CSS 里隐藏，交互改用 Typora 风格的顶部菜单；
 * - 菜单项统一走 runCommand()，内部程序化点击 Vditor 自己的按钮，
 *   这样 Markdown 语法处理、撤销栈、选区行为都还是 Vditor 原生实现；
 * - 链接/图片/源码模式/全屏需要弹窗或宿主状态，由 MarkdownEditor.vue 处理。
 */

export const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform || '')

/** 快捷键展示用前缀 */
export const modLabel = () => (isMac() ? '⌘' : 'Ctrl+')

/**
 * 顶部菜单（顺序、分隔、快捷键提示按 Typora 的「文件 / 编辑 / 段落 / 格式 / 视图」组织）。
 * cmd 为 'new' / 'import' / 'export-md' / 'export-html' / 'export-pdf' /
 * 'link' / 'image' / 'outline' / 'source' / 'fullscreen' 时由组件接管。
 */
export const MENUS = [
  {
    key: 'file',
    label: '文件',
    items: [
      { cmd: 'new', label: '新建', hint: 'N' },
      { divider: true },
      { cmd: 'import', label: '导入 Markdown…', hint: 'O' },
      { divider: true },
      { cmd: 'export-md', label: '导出 Markdown…' },
      { cmd: 'export-html', label: '导出 HTML…' },
      { cmd: 'export-pdf', label: '导出 PDF…' }
    ]
  },
  {
    key: 'edit',
    label: '编辑',
    items: [
      { cmd: 'undo', label: '撤销', hint: 'Z' },
      { cmd: 'redo', label: '重做', hint: 'Y' },
      { divider: true },
      { cmd: 'outdent', label: '减少缩进' },
      { cmd: 'indent', label: '增加缩进' }
    ]
  },
  {
    key: 'paragraph',
    label: '段落',
    items: [
      { cmd: 'h1', label: '一级标题' },
      { cmd: 'h2', label: '二级标题' },
      { cmd: 'h3', label: '三级标题' },
      { cmd: 'h4', label: '四级标题' },
      { cmd: 'h5', label: '五级标题' },
      { cmd: 'h6', label: '六级标题' },
      { divider: true },
      { cmd: 'paragraph', label: '正文' },
      { divider: true },
      { cmd: 'quote', label: '引用' },
      { cmd: 'list', label: '无序列表' },
      { cmd: 'ordered-list', label: '有序列表' },
      { cmd: 'check', label: '任务列表' },
      { divider: true },
      { cmd: 'code', label: '代码块' },
      { cmd: 'table', label: '表格' },
      { cmd: 'line', label: '水平分割线' }
    ]
  },
  {
    key: 'format',
    label: '格式',
    items: [
      { cmd: 'bold', label: '加粗', hint: 'B' },
      { cmd: 'italic', label: '斜体', hint: 'I' },
      { cmd: 'strike', label: '删除线' },
      { cmd: 'inline-code', label: '行内代码' },
      { divider: true },
      { cmd: 'link', label: '链接', hint: 'K' },
      { cmd: 'image', label: '图片' }
    ]
  },
  {
    key: 'view',
    label: '视图',
    items: [
      { cmd: 'outline', label: '大纲' },
      { cmd: 'source', label: '源码模式', hint: '/' },
      { divider: true },
      { cmd: 'fullscreen', label: '全屏' }
    ]
  }
]

/** 取 Vditor 某个工具栏项的按钮（工具栏本身被 CSS 隐藏，但元素与事件都在） */
function toolbarButton(vditor, key) {
  const elements = vditor && vditor.vditor && vditor.vditor.toolbar && vditor.vditor.toolbar.elements
  const item = elements && elements[key]
  if (!item) return null
  return item.querySelector(`[data-type="${key}"]`) || item.children[0] || null
}

/** 取标题面板里对应级别的按钮（data-value 形如 "## "） */
function headingButton(vditor, level) {
  const elements = vditor && vditor.vditor && vditor.vditor.toolbar && vditor.vditor.toolbar.elements
  const item = elements && elements.headings
  if (!item) return null
  return item.querySelector(`button[data-value="${'#'.repeat(level)} "]`)
}

/**
 * 执行 Typora 菜单命令。
 * @returns {boolean} 是否需要宿主（组件）另行处理
 */
export function runCommand(vditor, cmd) {
  const internal = vditor && vditor.vditor
  if (!internal) return false

  const level = /^h([1-6])$/.exec(cmd)
  if (level) {
    const button = headingButton(vditor, Number(level[1]))
    if (!button) return false
    button.click()
    return true
  }

  // 「正文」= 取消标题：Vditor 的标题按钮在已是标题时会退回正文
  if (cmd === 'paragraph') {
    const elements = internal.toolbar && internal.toolbar.elements
    const item = elements && elements.headings
    if (!item) return false
    const action = item.children[0]
    if (!action) return false
    action.click()
    const panel = item.querySelector('.vditor-hint')
    if (panel && panel.style.display === 'block') panel.style.display = 'none'
    return true
  }

  const button = toolbarButton(vditor, cmd)
  if (!button) return false
  button.click()
  return true
}

/** 源码模式：IR ↔ SV，复用 Vditor 的模式面板（同样隐藏） */
export function toggleSourceMode(vditor, markdown) {
  const internal = vditor && vditor.vditor
  if (!internal) return false
  const elements = internal.toolbar && internal.toolbar.elements
  const item = elements && elements['edit-mode']
  if (!item) return false
  const target = internal.currentMode === 'sv' ? 'ir' : 'sv'
  const button = item.querySelector(`button[data-mode="${target}"]`)
  if (!button) return false

  const undo = internal.undo
  const lute = internal.lute
  const markdownText = typeof markdown === 'string' ? markdown : ''
  const undoState = undo && undo[target]
  const normalize = (value) => String(value || '').replace('<wbr>', '').replace(/\s+$/, '')
  // 只有「目标模式还没有 undo 历史」或「两个模式的正文没有实质差异」时才能跳过
  // undo diff：否则撤销栈里的补丁基线会和当前正文对不上，撤销可能改坏内容。
  const canSkipUndo = Boolean(
    markdownText &&
      undoState &&
      (undoState.undoStack.length === 0 || normalize(undoState.lastText) === normalize(markdownText))
  )

  if (canSkipUndo) {
    // 大文档切换模式时，Vditor 会做两件很贵的事：
    // 1. setEditMode 用 getMarkdown() 把整棵 IR DOM 序列化成 Markdown；
    // 2. undoDelay(800ms) 后在 addToUndoStack 里再序列化一次并做 diff。
    // 这里把当前缓存的 Markdown 作为目标模式的 undo 基线，切换过程中用缓存
    // 替代 IR→Markdown 序列化，并在本次切换的 undo 记录完成前跳过 addToUndoStack。
    undoState.lastText = markdownText
    patchUndoStack(undo)
    const original = lute && lute.VditorIRDOM2Md
    if (original) lute.VditorIRDOM2Md = () => markdownText
    try {
      button.click()
    } finally {
      if (original) lute.VditorIRDOM2Md = original
    }
    patchUndoStack(undo)
    return true
  }

  button.click()
  return true
}

/** 切换模式期间临时跳过 undo diff（跨多次切换共用同一个定时器恢复） */
let undoRestoreTimer = 0
let pendingUndoOwner = null
let pendingAddToUndoStack = null

function patchUndoStack(undo) {
  if (!pendingAddToUndoStack && undo && typeof undo.addToUndoStack === 'function') {
    pendingUndoOwner = undo
    pendingAddToUndoStack = undo.addToUndoStack
    undo.addToUndoStack = () => {}
  }
  if (!pendingAddToUndoStack) return
  window.clearTimeout(undoRestoreTimer)
  // processAfterRender 会把 addToUndoStack 推迟到 undoDelay(800ms) 之后，留足余量恢复
  undoRestoreTimer = window.setTimeout(() => {
    if (pendingUndoOwner) pendingUndoOwner.addToUndoStack = pendingAddToUndoStack
    pendingUndoOwner = null
    pendingAddToUndoStack = null
  }, 1400)
}

export function getMode(vditor) {
  return (vditor && vditor.vditor && vditor.vditor.currentMode) || 'ir'
}

/**
 * 从 Markdown 文本解析标题大纲（跳过代码块里的 #）。
 * line 为 0 起始的行号，源码模式下用它定位 textarea。
 */
export function parseHeadings(markdown) {
  const lines = String(markdown || '').split('\n')
  const headings = []
  let fence = false
  lines.forEach((line, index) => {
    if (/^\s*(```|~~~)/.test(line)) {
      fence = !fence
      return
    }
    if (fence) return
    const match = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (!match) return
    headings.push({
      level: match[1].length,
      text: match[2].replace(/[*_`~[\]]/g, '').trim(),
      line: index
    })
  })
  return headings
}

/** 即时渲染模式下已渲染的标题元素，顺序与 Markdown 中的标题一一对应 */
function headingElements(vditor) {
  const internal = vditor && vditor.vditor
  if (!internal || !internal.ir || !internal.ir.element) return []
  return Array.from(internal.ir.element.querySelectorAll('h1, h2, h3, h4, h5, h6'))
}

/** 滚动到第 index 个标题（TOC 点击） */
export function scrollToHeading(vditor, index, line) {
  const internal = vditor && vditor.vditor
  if (!internal) return false
  if (internal.currentMode === 'sv') {
    const textarea = internal.sv && internal.sv.element
    if (!textarea) return false
    const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 22
    textarea.scrollTo({ top: Math.max(line * lineHeight - lineHeight, 0), behavior: 'smooth' })
    return true
  }
  const element = headingElements(vditor)[index]
  if (!element) return false
  const scroller = internal.ir.element
  const offset = element.getBoundingClientRect().top - scroller.getBoundingClientRect().top
  scroller.scrollTo({ top: Math.max(scroller.scrollTop + offset - 12, 0), behavior: 'smooth' })
  return true
}

/** 当前滚动位置对应的标题序号（滚动高亮用），没有则 -1 */
export function activeHeadingIndex(vditor) {
  const internal = vditor && vditor.vditor
  if (!internal) return -1
  if (internal.currentMode !== 'ir') return -1
  const scroller = internal.ir.element
  const line = scroller.getBoundingClientRect().top + 48
  let active = -1
  headingElements(vditor).forEach((element, index) => {
    if (element.getBoundingClientRect().top <= line) active = index
  })
  return active
}
