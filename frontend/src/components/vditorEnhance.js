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
  'col-del': { key: '_', shift: true, code: 'Minus' }
}

const TABLE_BUTTONS = [
  { op: 'row-above', label: '上方插行', title: '在当前行上方插入一行' },
  { op: 'row-below', label: '下方插行', title: '在当前行下方插入一行' },
  { op: 'row-del', label: '删除行', title: '删除当前行' },
  { op: 'col-left', label: '左侧插列', title: '在当前列左侧插入一列' },
  { op: 'col-right', label: '右侧插列', title: '在当前列右侧插入一列' },
  { op: 'col-del', label: '删除列', title: '删除当前列' },
  { op: 'table-del', label: '删除表格', title: '删除整个表格' }
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
    // 源码模式下没有渲染后的标题锚点，交回 Vditor 自己处理
    if (internal.currentMode !== 'ir') return
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

/** 找出 Markdown 里的所有表格块（行号区间） */
const findTableBlocks = (lines) => {
  const blocks = []
  let index = 0
  while (index < lines.length - 1) {
    const isRow = /^\s*\|.*\|\s*$/.test(lines[index])
    const isDivider = /^\s*\|?[\s:|-]+\|?\s*$/.test(lines[index + 1]) && lines[index + 1].includes('-')
    if (isRow && isDivider) {
      const start = index
      let end = index + 1
      while (end + 1 < lines.length && /^\s*\|.*\|\s*$/.test(lines[end + 1])) end += 1
      blocks.push({ start, end })
      index = end + 1
    } else {
      index += 1
    }
  }
  return blocks
}

/** 表格浮动工具条：鼠标移到表格上时出现，点击按钮复用 Vditor 的快捷键实现增删改。 */
function installTableTools(root, internal, vditor) {
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

    // 横向操作条：正下方，与表格左对齐；宽度超出编辑区时自动换行
    const panelRect = panel.getBoundingClientRect()
    let left = tableRect.left - rootRect.left
    left = Math.max(Math.min(left, root.clientWidth - panelRect.width - gap), gap)

    let top = tableRect.bottom - rootRect.top + gap
    const minTop = toolbarHeight + 4
    const maxTop = root.clientHeight - panelRect.height - gap
    if (top > maxTop) {
      // 下方空间不够时贴到编辑区底部，尽量贴近表格
      top = Math.max(maxTop, minTop)
    }
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
    if (internal.currentMode !== 'ir') return
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

  /** 删除整张表格：按 Markdown 文本定位并移除对应表格块 */
  const deleteWholeTable = () => {
    if (!anchor) return
    const markdown = vditor.getValue()
    const blocks = findTableBlocks(markdown.split('\n'))
    const block = blocks[anchor.tableIndex]
    if (!block) return
    const lines = markdown.split('\n')
    const next = lines.slice(0, block.start).concat(lines.slice(block.end + 1))
    const cleaned = next
      .join('\n')
      .replace(/\u200b/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/^\n+/, '')
      .replace(/\n+$/, '\n')
    const pre = internal.ir.element
    const savedScroll = pre.scrollTop
    hide()
    vditor.setValue(cleaned, false)
    // setValue 的 enableInput 为 false，这里手动通知外层（v-model）同步
    if (internal.options && typeof internal.options.input === 'function') {
      internal.options.input(cleaned)
    }
    pre.scrollTop = savedScroll
  }

  const dispatchOp = (op) => {
    if (op === 'table-del') {
      deleteWholeTable()
      return
    }
    const config = TABLE_OPS[op]
    const found = resolve()
    if (!config || !found) return
    const { cell } = found
    const editor = internal.ir.element
    editor.focus()
    const range = document.createRange()
    range.selectNodeContents(cell)
    range.collapse(true)
    // 选区起点落在单元格内部（文本节点或子元素），Vditor 才能识别当前单元格/列
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

  // Vditor 会重算正文 padding 与尺寸，窗口变化后操作条也要重新定位
  const reposition = () => {
    if (panel.classList.contains('is-open')) place()
  }
  const paddingObserver = new MutationObserver(reposition)
  paddingObserver.observe(internal.ir.element, { attributes: true, attributeFilter: ['style'] })
  const offResize = on(window, 'resize', reposition)
  // 切到源码模式时收起表格操作条
  const offMode = on(root, 'vditor-mode-change', hide)

  return () => {
    offOver()
    offLeave()
    offOut()
    offClick()
    offScroll()
    offResize()
    offMode()
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
    if (internal.currentMode !== 'ir') {
      numbers.style.display = 'none'
      return
    }
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
  // 源码模式 / 即时渲染切换后重新测量（源码模式下隐藏行号）
  const offMode = on(root, 'vditor-mode-change', schedule)

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
    offMode()
    contentObserver.disconnect()
    styleObserver.disconnect()
    if (frame) window.cancelAnimationFrame(frame)
    if (timer) window.clearTimeout(timer)
    numbers.remove()
  }
}

/**
 * 源码模式开关。
 *
 * 复用 Vditor 内置的 edit-mode 面板（隐藏起来），点我们的「源码」按钮时
 * 程序化点击面板里对应的 ir / sv 项，这样布局、texture、撤销栈都由 Vditor 处理。
 */
function installSourceMode(root, internal) {
  const toolbar = root.querySelector('.vditor-toolbar')
  const editModeItem = internal.toolbar && internal.toolbar.elements['edit-mode']
  if (!toolbar || !editModeItem) return () => {}
  editModeItem.style.display = 'none'

  const wrapper = document.createElement('div')
  wrapper.className = 'vditor-toolbar__item'
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'vditor-tooltipped vditor-tooltipped__n'
  button.dataset.type = 'source-mode'
  button.setAttribute('aria-label', '源码模式')
  button.setAttribute('aria-pressed', 'false')
  button.innerHTML = '<span class="vditor-tb-glyph">&lt;/&gt;</span><span class="vditor-tb-label">源码</span>'
  wrapper.appendChild(button)
  toolbar.insertBefore(wrapper, editModeItem)

  const sync = () => {
    const isSource = internal.currentMode === 'sv'
    button.classList.toggle('vditor-menu--current', isSource)
    button.setAttribute('aria-pressed', isSource ? 'true' : 'false')
    root.dispatchEvent(new CustomEvent('vditor-mode-change', { detail: internal.currentMode }))
  }

  const onClick = (event) => {
    event.preventDefault()
    const target = internal.currentMode === 'sv' ? 'ir' : 'sv'
    const modeButton = editModeItem.querySelector(`button[data-mode="${target}"]`)
    if (modeButton) modeButton.click()
    sync()
  }

  button.addEventListener('click', onClick)
  sync()

  return () => {
    button.removeEventListener('click', onClick)
    wrapper.remove()
    editModeItem.style.display = ''
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
    installTableTools(root, internal, vditor),
    installLineNumbers(root, internal),
    installSourceMode(root, internal),
    fixFullscreen(root)
  ]
  return () => disposers.forEach((dispose) => dispose())
}
