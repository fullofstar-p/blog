/**
 * Vditor 编辑器增强（不依赖 Vue，便于在浏览器中单独验证）。
 *
 * 只保留 Typora 式外壳需要、Vditor 本身不提供的能力：
 * 1. 表格操作条：鼠标移到表格上时，在表格左上角浮出一排图标按钮
 *    （上方/下方插行、删除行、左侧/右侧插列、删除列、删除表格），
 *    复用 Vditor 自己的表格快捷键实现，保证撤销栈与 Markdown 文本一致；
 * 2. 左侧行号：IR 模式没有真实源码行，按渲染后的可视行编号；
 * 3. 代码块语言角标：从围栏信息里取语言名，显示在代码块右下角。
 *
 * 工具栏本身由 MarkdownEditor.vue 隐藏并换成顶部菜单，这里不再处理工具栏。
 */

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

const svg = (paths) =>
  `<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`

const TABLE_BUTTONS = [
  {
    op: 'row-above',
    label: '上方插入行',
    icon: svg('<rect x="1.8" y="7.6" width="12.4" height="6.6" rx="1"/><path d="M8 1.6v4M5.6 3.6 8 1.2l2.4 2.4"/>')
  },
  {
    op: 'row-below',
    label: '下方插入行',
    icon: svg('<rect x="1.8" y="1.8" width="12.4" height="6.6" rx="1"/><path d="M8 14.4v-4M5.6 12.4 8 14.8l2.4-2.4"/>')
  },
  {
    op: 'row-del',
    label: '删除行',
    icon: svg('<rect x="1.8" y="1.8" width="12.4" height="12.4" rx="1"/><path d="M4 8h8"/>')
  },
  {
    op: 'col-left',
    label: '左侧插入列',
    icon: svg('<rect x="7.6" y="1.8" width="6.6" height="12.4" rx="1"/><path d="M1.6 8h4M3.6 5.6 1.2 8l2.4 2.4"/>')
  },
  {
    op: 'col-right',
    label: '右侧插入列',
    icon: svg('<rect x="1.8" y="1.8" width="6.6" height="12.4" rx="1"/><path d="M14.4 8h-4M12.4 5.6 14.8 8l-2.4 2.4"/>')
  },
  {
    op: 'col-del',
    label: '删除列',
    icon: svg('<rect x="1.8" y="1.8" width="12.4" height="12.4" rx="1"/><path d="M8 4v8"/>')
  },
  {
    op: 'table-del',
    label: '删除表格',
    icon: svg('<path d="M2.6 4.4h10.8M6.2 2.4h3.6M4.2 4.4l.7 9.2h6.2l.7-9.2M6.6 6.8v4.2M9.4 6.8v4.2"/>')
  }
]

const on = (el, type, handler, options) => {
  el.addEventListener(type, handler, options)
  return () => el.removeEventListener(type, handler, options)
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

/**
 * 表格工具条（Typora 风格）：表格左上角的一排小图标，悬停表格时出现。
 * 点击不是直接改 DOM，而是模拟 Vditor 的表格快捷键，保证 Markdown 文本同步。
 */
function installTableTools(root, internal, vditor) {
  const panel = document.createElement('div')
  panel.className = 'vditor-table-tools'
  panel.setAttribute('role', 'toolbar')
  panel.setAttribute('aria-label', '表格操作')
  TABLE_BUTTONS.forEach(({ op, label, icon }) => {
    const button = document.createElement('button')
    button.type = 'button'
    button.dataset.op = op
    button.title = label
    button.setAttribute('aria-label', label)
    button.innerHTML = icon
    panel.appendChild(button)
  })
  root.appendChild(panel)

  // 记录「第几张表、第几行、第几列」，因为每次操作后 Vditor 会重建表格 DOM
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
    const gap = 4
    const margin = 6

    let left = tableRect.left - rootRect.left
    left = Math.max(Math.min(left, root.clientWidth - panelRect.width - margin), margin)

    // Typora：工具条贴在表格左上角外侧；表格滚到编辑区顶部时落到表格内部
    let top = tableRect.top - rootRect.top - panelRect.height - gap
    if (top < margin) top = tableRect.top - rootRect.top + margin
    top = Math.min(top, root.clientHeight - panelRect.height - margin)

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

  const revealFor = (target) => {
    if (internal.currentMode !== 'ir') return
    if (!target || !target.closest) return
    if (target.closest('.vditor-table-tools')) {
      window.clearTimeout(hideTimer)
      return
    }
    const cell = target.closest('td, th')
    if (cell && root.contains(cell)) {
      window.clearTimeout(hideTimer)
      show(cell)
      return
    }
    if (anchor) scheduleHide()
  }

  const offOver = on(root, 'mouseover', (event) => revealFor(event.target))
  const offFocus = on(root, 'keyup', () => {
    const selection = window.getSelection()
    if (!selection || !selection.anchorNode) return
    const node = selection.anchorNode.nodeType === 1 ? selection.anchorNode : selection.anchorNode.parentElement
    revealFor(node)
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
      if (!resolve()) {
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

  // 切到源码模式时立即收起（Vditor 重渲染后位置也会失效）
  const offMode = on(root, 'vditor-mode-change', hide)

  const reposition = () => {
    if (panel.classList.contains('is-open')) place()
  }
  const paddingObserver = new MutationObserver(reposition)
  paddingObserver.observe(internal.ir.element, { attributes: true, attributeFilter: ['style'] })
  const offResize = on(window, 'resize', reposition)

  return () => {
    offOver()
    offFocus()
    offLeave()
    offOut()
    offClick()
    offScroll()
    offMode()
    offResize()
    paddingObserver.disconnect()
    window.clearTimeout(hideTimer)
    panel.remove()
  }
}

/**
 * 左侧行号。
 *
 * IR 模式没有真正的“源码行”，这里按渲染后的可视行编号：
 * 遍历正文文本节点，用 Range.getClientRects() 拿到每一行的位置，
 * 去重后把序号画在左侧留白里（不参与正文布局、不响应鼠标）。
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
    const width = padLeft - 20
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
      const offset = Math.max((line.height - 16) / 2, 0)
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

  // Vditor 会重算 padding（resize、全屏），这里把左侧额外留白补回去
  const styleObserver = new MutationObserver(() => {
    ensurePadding()
    schedule()
  })
  styleObserver.observe(pre, { attributes: true, attributeFilter: ['style'] })

  schedule()
  window.setTimeout(schedule, 400)

  // 源码模式 / 即时渲染切换后立刻隐藏或重新测量
  const offMode = on(root, 'vditor-mode-change', () => {
    if (internal.currentMode !== 'ir') numbers.style.display = 'none'
    schedule()
  })

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
 * 代码块语言角标（Typora 在代码块右下角显示语言名）。
 * 只写 data-lang 属性，由 CSS ::after 渲染，不往 DOM 里塞节点，避免影响 Markdown 序列化。
 */
function installCodeLanguage(root) {
  let frame = 0

  const apply = () => {
    frame = 0
    if (root.querySelectorAll('.vditor-ir__node[data-type="code-block"]').length === 0) return
    root.querySelectorAll('.vditor-ir__node[data-type="code-block"]').forEach((node) => {
      const preview = node.querySelector('.vditor-ir__preview')
      if (!preview) return
      const info = node.querySelector('.vditor-ir__marker--info')
      const lang = info ? info.textContent.replace(/[\u200b\ufeff]/g, '').trim() : ''
      if (lang) {
        if (preview.getAttribute('data-lang') !== lang) preview.setAttribute('data-lang', lang)
      } else if (preview.hasAttribute('data-lang')) {
        preview.removeAttribute('data-lang')
      }
    })
  }

  const schedule = () => {
    if (frame) return
    frame = window.requestAnimationFrame(apply)
  }

  const observer = new MutationObserver(schedule)
  observer.observe(root, { childList: true, subtree: true, characterData: true })
  schedule()

  return () => {
    observer.disconnect()
    if (frame) window.cancelAnimationFrame(frame)
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
    installTableTools(root, internal, vditor),
    installLineNumbers(root, internal),
    installCodeLanguage(root)
  ]
  return () => disposers.forEach((dispose) => dispose())
}
