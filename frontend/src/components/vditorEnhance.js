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
  { op: 'row-above', label: '行↑', title: '在当前行上方插入一行' },
  { op: 'row-below', label: '行↓', title: '在当前行下方插入一行' },
  { op: 'row-del', label: '删行', title: '删除当前行' },
  { op: 'col-left', label: '列←', title: '在当前列左侧插入一列' },
  { op: 'col-right', label: '列→', title: '在当前列右侧插入一列' },
  { op: 'col-del', label: '删列', title: '删除当前列' },
  { op: 'align-left', label: '左', title: '当前列左对齐' },
  { op: 'align-center', label: '中', title: '当前列居中对齐' },
  { op: 'align-right', label: '右', title: '当前列右对齐' }
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
    const toolbar = root.querySelector('.vditor-toolbar')
    const toolbarHeight = toolbar ? toolbar.offsetHeight : 0
    const gap = 8

    // 正文容器左右各有一段 padding，右侧这条留白带可以塞下一条竖排操作条，
    // 完全压不到正文与表格；padding 太窄（窄屏）时退化成表格右上角的小面板。
    const pre = internal.ir.element
    const preStyle = getComputedStyle(pre)
    const padRight = parseFloat(preStyle.paddingRight) || 0
    const rail = padRight >= 34 && root.clientWidth >= 520
    panel.classList.toggle('is-rail', rail)
    panel.classList.toggle('is-grid', !rail)

    if (rail) {
      const railWidth = Math.max(24, Math.min(40, padRight - 8))
      panel.style.width = `${railWidth}px`
      const boxWidth = panel.offsetWidth
      const scrollbarWidth = pre.offsetWidth - pre.clientWidth
      const preRect = pre.getBoundingClientRect()
      const contentRight = preRect.right - scrollbarWidth - padRight
      let left = contentRight - rootRect.left + 1
      left = Math.max(Math.min(left, preRect.right - rootRect.left - boxWidth - 1), 6)
      let top = tableRect.bottom - rootRect.top + gap
      const maxTop = root.clientHeight - panel.offsetHeight - 6
      top = Math.min(Math.max(top, toolbarHeight + 4), Math.max(maxTop, toolbarHeight + 4))
      panel.style.top = `${top}px`
      panel.style.left = `${left}px`
      return true
    }

    // 窄屏兜底：贴表格右下角，尽量只压住右侧留白
    panel.style.width = ''
    const panelRect = panel.getBoundingClientRect()
    let left = tableRect.right - rootRect.left - panelRect.width
    left = Math.max(Math.min(left, root.clientWidth - panelRect.width - gap), gap)
    let top = tableRect.bottom - rootRect.top + gap
    const maxTop = root.clientHeight - panelRect.height - 6
    top = Math.min(Math.max(top, toolbarHeight + 4), Math.max(maxTop, toolbarHeight + 4))
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
    // 首次显示时字号/滚动条可能还没稳定，下一帧再校正一次
    window.requestAnimationFrame(() => {
      if (panel.classList.contains('is-open')) place()
    })
  }

  const hide = () => {
    panel.classList.remove('is-open')
    anchor = null
  }

  const scheduleHide = () => {
    window.clearTimeout(hideTimer)
    hideTimer = window.setTimeout(hide, 350)
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
    // 对齐用的 setTableAlign 依赖 startContainer.parentElement 找当前列，
    // 起点必须落在单元格内部（文本节点或子元素），不能是 <td> 本身
    if (!cell.firstChild) {
      cell.appendChild(document.createTextNode(''))
    }
    range.setStart(cell.firstChild, 0)
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

  // Vditor 会根据容器宽度重算正文左右 padding（会改变留白带宽度），窗口尺寸变化也要重排
  const reposition = () => {
    if (panel.classList.contains('is-open')) place()
  }
  const paddingObserver = new MutationObserver(reposition)
  paddingObserver.observe(internal.ir.element, { attributes: true, attributeFilter: ['style'] })
  const offResize = on(window, 'resize', reposition)

  return () => {
    offOver()
    offLeave()
    offOut()
    offClick()
    offScroll()
    offResize()
    paddingObserver.disconnect()
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
 * 左侧行号。
 *
 * IR 模式没有真正的“源码行”，这里按渲染后的可视行编号：
 * 遍历正文文本节点，用 Range.getClientRects() 拿到每一行的位置，
 * 去重后把序号画在左侧留白里（不参与正文布局、不响应鼠标）。
 * 为了不压住 Vditor 自己的 H1/H2 标记，给正文左侧额外留出 30px。
 */
function installLineNumbers(root, internal) {
  const pre = internal.ir.element
  const numbers = document.createElement('div')
  numbers.className = 'vditor-line-numbers'
  numbers.setAttribute('aria-hidden', 'true')
  const track = document.createElement('div')
  track.className = 'vditor-line-numbers__track'
  numbers.appendChild(track)
  root.appendChild(numbers)

  const EXTRA_LEFT = 30
  let frame = 0
  let timer = 0

  const ensurePadding = () => {
    const right = parseFloat(pre.style.paddingRight) || 0
    // 窄屏（移动端）本来就放不下行号，就别再挤占正文宽度
    const want = right >= 40 ? right + EXTRA_LEFT : right
    if (!want) return
    const left = parseFloat(pre.style.paddingLeft) || 0
    if (Math.abs(left - want) > 0.5) {
      pre.style.paddingLeft = `${want}px`
    }
  }

  const render = () => {
    frame = 0
    ensurePadding()
    const preRect = pre.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    const padLeft = parseFloat(getComputedStyle(pre).paddingLeft) || 0
    const width = padLeft - 34
    if (width < 14 || preRect.height === 0) {
      numbers.style.display = 'none'
      return
    }
    numbers.style.display = 'block'
    numbers.style.top = `${preRect.top - rootRect.top}px`
    numbers.style.left = `${preRect.left - rootRect.left + 4}px`
    numbers.style.width = `${width}px`
    numbers.style.height = `${pre.clientHeight}px`

    const range = document.createRange()
    const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) =>
        /[^\s\u200b\ufeff]/.test(node.nodeValue || '') ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    })
    const lineTops = []
    let node = walker.nextNode()
    while (node) {
      // 折叠状态的 IR 标记（#、```、表格竖线等）高度为 0，但文本仍有 rect，需要排除
      const marker = node.parentElement && node.parentElement.closest('[class*="vditor-ir__marker"]')
      if (marker && marker.getBoundingClientRect().height < 2) {
        node = walker.nextNode()
        continue
      }
      range.selectNodeContents(node)
      const rects = range.getClientRects()
      for (let i = 0; i < rects.length; i += 1) {
        const rect = rects[i]
        if (rect.height < 2) continue
        lineTops.push({ top: rect.top - preRect.top + pre.scrollTop, height: rect.height })
      }
      node = walker.nextNode()
    }
    lineTops.sort((a, b) => a.top - b.top)
    const merged = []
    lineTops.forEach((line) => {
      if (!merged.length || line.top - merged[merged.length - 1].top > 6) {
        merged.push(line)
      }
    })

    let html = ''
    merged.forEach((line, index) => {
      const offset = Math.max((line.height - 15) / 2, 0)
      html += `<span style="top:${Math.round(line.top + offset)}px">${index + 1}</span>`
    })
    track.innerHTML = html
    track.style.transform = `translateY(${-pre.scrollTop}px)`
  }

  const schedule = () => {
    if (timer) window.clearTimeout(timer)
    timer = window.setTimeout(() => {
      timer = 0
      if (!frame) frame = window.requestAnimationFrame(render)
    }, 120)
  }

  const syncScroll = () => {
    track.style.transform = `translateY(${-pre.scrollTop}px)`
  }

  const offScroll = on(pre, 'scroll', syncScroll)
  const offResize = on(window, 'resize', schedule)

  // 正文重渲染（输入、插入表格/代码块、外部 setValue）后重新测量
  const contentObserver = new MutationObserver(schedule)
  contentObserver.observe(pre, { childList: true, subtree: true, characterData: true })

  // Vditor 会重算 padding（resize、大纲切换、全屏），这里把左侧额外留白补回去
  const styleObserver = new MutationObserver(() => {
    ensurePadding()
    schedule()
  })
  styleObserver.observe(pre, { attributes: true, attributeFilter: ['style'] })

  schedule()
  window.setTimeout(schedule, 400)

  return () => {
    offScroll()
    offResize()
    contentObserver.disconnect()
    styleObserver.disconnect()
    if (frame) window.cancelAnimationFrame(frame)
    if (timer) window.clearTimeout(timer)
    numbers.remove()
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
  const disposers = [
    decorateToolbar(root),
    fixOutlineJump(root, internal),
    installTableTools(root, internal),
    installLineNumbers(root, internal),
    fixFullscreen(root)
  ]
  return () => disposers.forEach((dispose) => dispose())
}
