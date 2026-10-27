/**
 * Vditor 编辑器增强（不依赖 Vue，便于在浏览器中单独验证）。
 *
 * 解决四类问题：
 * 1. 工具栏只有图标，鼠标悬停也没提示（提示框被 .vditor 的 overflow: hidden 裁掉）；
 * 2. 表格在即时渲染模式下没有任何操作入口（Vditor 只给所见即所得模式做了浮层）；
 * 3. 大纲点击标题时 Vditor 会调用 window.scrollTo(vditor.element.offsetTop)，
 *    而 offsetTop 是相对 .sketch-card（position: relative）的，导致整页跳到顶部；
 * 4. 编辑区所在的 .sketch-card 带 rotate 变换，形成 fixed 定位的包含块，
 *    全屏时 .vditor--fullscreen 只铺满卡片而不是视口。
 */

const LABELS = {
  headings: '标题',
  bold: '加粗',
  italic: '斜体',
  strike: '删除',
  list: '无序',
  'ordered-list': '有序',
  check: '任务',
  outdent: '减缩',
  indent: '增效',
  quote: '引用',
  line: '分割',
  code: '代码',
  'inline-code': '行内',
  link: '链接',
  table: '表格',
  upload: '图片',
  undo: '撤销',
  redo: '重做',
  outline: '大纲',
  fullscreen: '全屏'
}

const isMac = () => /Mac|iPhone|iPad/.test(navigator.platform)

/** 表格操作 → Vditor 内置快捷键（IR 模式的 fixTable 已实现这些操作） */
const TABLE_OPS = {
  'row-above': { key: 'F', shift: true, code: 'KeyF' },
  'row-below': { key: '=', shift: false, code: 'Equal' },
  'col-left': { key: 'G', shift: true, code: 'KeyG' },
  'col-right': { key: '+', shift: true, code: 'Equal' },
  'row-del': { key: '-', shift: false, code: 'Minus' },
  'col-del': { key: '_', shift: true, code: 'Minus' },
  'align-left': { key: 'L', shift: true, code: 'KeyL' },
  'align-center': { key: 'C', shift: true, code: 'KeyC' },
  'align-right': { key: 'R', shift: true, code: 'KeyR' }
}

const TABLE_BUTTONS = [
  { op: 'row-above', label: '上方插行', title: '在当前行上方插入一行' },
  { op: 'row-below', label: '下方插行', title: '在当前行下方插入一行' },
  { op: 'row-del', label: '删除行', title: '删除当前行' },
  { op: 'col-left', label: '左侧插列', title: '在当前列左侧插入一列' },
  { op: 'col-right', label: '右侧插列', title: '在当前列右侧插入一列' },
  { op: 'col-del', label: '删除列', title: '删除当前列' },
  { op: 'align-left', label: '左对齐', title: '当前列左对齐' },
  { op: 'align-center', label: '居中', title: '当前列居中对齐' },
  { op: 'align-right', label: '右对齐', title: '当前列右对齐' }
]

const on = (el, type, handler, options) => {
  el.addEventListener(type, handler, options)
  return () => el.removeEventListener(type, handler, options)
}

/**
 * 给工具栏按钮补上中文名称。
 * Vditor 的按钮内容会被它自己重写（例如全屏图标切换），所以用 MutationObserver 补挂。
 */
function decorateToolbar(root) {
  const apply = () => {
    root.querySelectorAll('.vditor-toolbar__item > [data-type]').forEach((btn) => {
      const name = LABELS[btn.getAttribute('data-type')]
      if (!name || btn.querySelector('.vditor-tb-label')) return
      const label = document.createElement('span')
      label.className = 'vditor-tb-label'
      label.textContent = name
      btn.appendChild(label)
    })
  }
  apply()
  const observer = new MutationObserver(apply)
  observer.observe(root.querySelector('.vditor-toolbar'), { childList: true, subtree: true })
  return () => observer.disconnect()
}

/**
 * 大纲点击：自己滚动正文容器，并阻止 Vditor 原生的 window.scrollTo。
 * 原生逻辑用的是相对卡片定位的 offsetTop，会把整页卷到顶部。
 */
function fixOutlineJump(vditorEl, internal) {
  const content = vditorEl.querySelector('.vditor-outline__content')
  if (!content) return () => {}

  const handler = (event) => {
    const target = event.target
    if (!target || !target.closest) return
    // 折叠/展开箭头交给 Vditor 自己处理
    if (target.closest('.vditor-outline__action')) return
    const link = target.closest('[data-target-id]')
    if (!link) return

    event.preventDefault()
    event.stopPropagation()

    const heading = document.getElementById(link.getAttribute('data-target-id'))
    if (!heading) return

    const scroller = internal.ir.element
    const offset = heading.getBoundingClientRect().top - scroller.getBoundingClientRect().top
    scroller.scrollTo({ top: Math.max(scroller.scrollTop + offset - 8, 0), behavior: 'smooth' })
  }

  // 捕获阶段拦截，避免 Vditor 绑定在列表上的 click 再触发一次滚动
  return on(content, 'click', handler, true)
}

/** 表格浮动工具条：鼠标移到表格上时出现，点击按钮复用 Vditor 的快捷键实现增删改。 */
function installTableTools(root, internal) {
  const panel = document.createElement('div')
  panel.className = 'vditor-table-tools'
  panel.setAttribute('role', 'toolbar')
  panel.setAttribute('aria-label', '表格操作')
  TABLE_BUTTONS.forEach(({ op, label, title }) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.op = op
    button.textContent = label
    button.title = title
    panel.appendChild(button)
  })
  root.appendChild(panel)

  // 记录“第几张表、第几行、第几列”，因为每次操作后 Vditor 会重建表格 DOM
  let anchor = null
  let hideTimer = 0

  const locate = (cell) => {
    const table = cell.closest('table')
    if (!table || !root.contains(table)) return null
    const tables = Array.from(root.querySelectorAll('.vditor-ir table'))
    const tableIndex = tables.indexOf(table)
    if (tableIndex < 0) return null
    let rowIndex = -1
    for (let i = 0; i < table.rows.length; i += 1) {
      if (table.rows[i].contains(cell)) {
        rowIndex = i
        break
      }
    }
    if (rowIndex < 0) return null
    const cellIndex = Array.prototype.indexOf.call(table.rows[rowIndex].cells, cell)
    if (cellIndex < 0) return null
    return { tableIndex, rowIndex, cellIndex }
  }

  const resolve = () => {
    if (!anchor) return null
    const tables = root.querySelectorAll('.vditor-ir table')
    const table = tables[anchor.tableIndex]
    if (!table || !table.rows.length) return null
    const rowIndex = Math.min(anchor.rowIndex, table.rows.length - 1)
    const row = table.rows[rowIndex]
    if (!row || !row.cells.length) return null
    const cellIndex = Math.min(anchor.cellIndex, row.cells.length - 1)
    return { table, cell: row.cells[cellIndex] }
  }

  const place = () => {
    const found = resolve()
    if (!found) return false
    const tableRect = found.table.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    const above = tableRect.top - rootRect.top - panelRect.height - 8
    const top = above > 60 ? above : tableRect.bottom - rootRect.top + 8
    const left = Math.max(tableRect.left - rootRect.left, 8)
    panel.style.top = `${top}px`
    panel.style.left = `${left}px`
    return true
  }

  const show = (nextCell) => {
    const next = locate(nextCell)
    if (!next) return
    anchor = next
    panel.classList.add('is-open')
    place()
  }

  const hide = () => {
    panel.classList.remove('is-open')
    anchor = null
  }

  const scheduleHide = () => {
    window.clearTimeout(hideTimer)
    hideTimer = window.setTimeout(hide, 220)
  }

  const offOver = on(root, 'mouseover', (event) => {
    const target = event.target
    if (!target || !target.closest) return
    if (target.closest('.vditor-table-tools')) {
      window.clearTimeout(hideTimer)
      return
    }
    const nextCell = target.closest('td, th')
    if (nextCell && root.contains(nextCell)) {
      window.clearTimeout(hideTimer)
      show(nextCell)
      return
    }
    if (anchor) scheduleHide()
  })

  const offLeave = on(panel, 'mouseenter', () => window.clearTimeout(hideTimer))
  const offOut = on(panel, 'mouseleave', scheduleHide)

  const adjustAnchor = (op) => {
    if (!anchor) return
    if (op === 'row-above') anchor.rowIndex += 1
    if (op === 'col-left') anchor.cellIndex += 1
    if (op === 'row-del') anchor.rowIndex = Math.max(anchor.rowIndex - 1, 0)
    if (op === 'col-del') anchor.cellIndex = Math.max(anchor.cellIndex - 1, 0)
  }

  const dispatchOp = (op) => {
    const config = TABLE_OPS[op]
    const found = resolve()
    if (!config || !found) return
    const { cell } = found
    const editor = internal.ir.element
    editor.focus()
    const range = document.createRange()
    range.selectNodeContents(cell)
    range.collapse(true)
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)

    const mac = isMac()
    const event = new KeyboardEvent('keydown', {
      key: config.key,
      code: config.code,
      bubbles: true,
      cancelable: true,
      ctrlKey: !mac,
      metaKey: mac,
      shiftKey: config.shift,
      altKey: false
    })
    editor.dispatchEvent(event)
    adjustAnchor(op)
    // 表格结构变化后重新定位；单元格/表格被删掉时收起面板
    window.setTimeout(() => {
      const next = resolve()
      if (!next) {
        hide()
        return
      }
      place()
    }, 120)
  }

  const offClick = on(panel, 'mousedown', (event) => {
    // 保持编辑区选区不丢失
    event.preventDefault()
    const button = event.target.closest('button[data-op]')
    if (button) dispatchOp(button.dataset.op)
  })

  const offScroll = on(internal.ir.element, 'scroll', () => {
    if (panel.classList.contains('is-open')) place()
  })

  return () => {
    offOver()
    offLeave()
    offOut()
    offClick()
    offScroll()
    window.clearTimeout(hideTimer)
    panel.remove()
  }
}

/** 全屏：临时去掉祖先上的 transform / filter，否则 fixed 会以卡片为包含块。 */
function fixFullscreen(root) {
  let cleared = []

  const clearAncestors = () => {
    cleared = []
    let el = root.parentElement
    while (el && el !== document.body) {
      const style = getComputedStyle(el)
      const dirty =
        style.transform !== 'none' ||
        style.filter !== 'none' ||
        style.perspective !== 'none' ||
        style.willChange.includes('transform')
      if (dirty) {
        cleared.push({
          el,
          transform: el.style.transform,
          filter: el.style.filter,
          perspective: el.style.perspective,
          willChange: el.style.willChange
        })
        el.style.transform = 'none'
        el.style.filter = 'none'
        el.style.perspective = 'none'
        el.style.willChange = 'auto'
      }
      el = el.parentElement
    }
  }

  const restore = () => {
    cleared.forEach(({ el, transform, filter, perspective, willChange }) => {
      el.style.transform = transform
      el.style.filter = filter
      el.style.perspective = perspective
      el.style.willChange = willChange
    })
    cleared = []
  }

  const sync = () => {
    if (root.classList.contains('vditor--fullscreen')) {
      if (!cleared.length) clearAncestors()
    } else if (cleared.length) {
      restore()
    }
  }

  const observer = new MutationObserver(sync)
  observer.observe(root, { attributes: true, attributeFilter: ['class'] })

  return () => {
    observer.disconnect()
    restore()
  }
}

/**
 * 安装全部增强。返回 dispose 函数，组件卸载时调用。
 * @param {import('vditor').default} vditor Vditor 实例
 */
export function enhanceVditor(vditor) {
  const internal = vditor && vditor.vditor
  if (!internal || !internal.element) return () => {}
  const root = internal.element
  const disposers = [decorateToolbar(root), fixOutlineJump(root, internal), installTableTools(root, internal), fixFullscreen(root)]
  return () => disposers.forEach((dispose) => dispose())
}
