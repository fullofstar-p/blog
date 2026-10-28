/**
 * Vditor 编辑器增强（不依赖 Vue，便于在浏览器中单独验证）。
 *
 * 只保留 Typora 式外壳需要、Vditor 本身不提供的能力：
 * 1. 表格工具条：鼠标移到表格上时，在表格左上角浮出一排图标按钮
 *    （上方/下方插行、删除行、左侧/右侧插列、删除列、删除表格），
 *    复用 Vditor 自己的表格快捷键实现，保证撤销栈与 Markdown 文本一致；
 * 2. 代码块语言：悬停代码块时在右下角出现语言按钮，点击可从常用语言里选择，
 *    选择后直接改 Markdown 围栏语言并重新渲染（Typora 的「右下角选语言」）；
 * 3. 代码块编辑：Tab / Shift+Tab 缩进与反缩进（Vditor 默认 Tab 会跳出编辑区）；
 * 4. Markdown 快捷输入：表格源码（表头 + 分隔行）按回车后直接转成表格。
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

const ICON_ATTRS =
  'viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"'
const svg = (paths) => `<svg ${ICON_ATTRS}>${paths}</svg>`

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

/** 代码块语言下拉里提供的常用语言（与 Vditor 内置 highlight.js 对齐） */
const CODE_LANGS = [
  'text',
  'js',
  'ts',
  'html',
  'css',
  'json',
  'java',
  'python',
  'go',
  'rust',
  'sql',
  'bash',
  'yaml',
  'markdown',
  'c',
  'cpp',
  'csharp',
  'php',
  'ruby',
  'kotlin',
  'swift',
  'xml',
  'dockerfile',
  'diff'
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

/** 代码块序号 → 替换该围栏的语言标识 */
const replaceFenceLang = (markdown, blockIndex, lang) => {
  const lines = markdown.split('\n')
  let count = -1
  let fence = ''
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^(\s*)(`{3,}|~{3,})(.*)$/.exec(lines[i])
    if (!match) continue
    if (!fence) {
      count += 1
      if (count === blockIndex) {
        lines[i] = `${match[1]}${match[2]}${lang}`
        return lines.join('\n')
      }
      fence = match[2]
    } else if (match[2].startsWith(fence[0].repeat(3)) && !match[3].trim()) {
      fence = ''
    }
  }
  return markdown
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
    let cell = found.cell
    // 表头行上做行操作时 Vditor 会忽略，这里改成作用在第一行数据行上
    const isRowOp = op === 'row-above' || op === 'row-below' || op === 'row-del'
    const inHead = found.table.tHead && found.table.tHead.contains(found.cell)
    if (isRowOp && inHead) {
      const bodyRow = found.table.tBodies[0] && found.table.tBodies[0].rows[0]
      if (!bodyRow || !bodyRow.cells.length) return
      cell = bodyRow.cells[Math.min(anchor.cellIndex, bodyRow.cells.length - 1)]
      anchor.rowIndex = 1
    }
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

  const reposition = () => {
    if (panel.classList.contains('is-open')) place()
  }
  const paddingObserver = new MutationObserver(reposition)
  paddingObserver.observe(internal.ir.element, { attributes: true, attributeFilter: ['style'] })
  const offResize = on(window, 'resize', reposition)
  // 切到源码模式时立即收起（Vditor 重渲染后位置也会失效）
  const offMode = on(root, 'vditor-mode-change', hide)

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
 * 代码块语言选择：悬停代码块时在右下角浮出语言按钮（Typora 的位置），
 * 点击弹出常用语言，选择后改写 Markdown 围栏并重新渲染。
 */
function installCodeLanguage(root, internal, vditor) {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'vditor-code-lang'
  button.hidden = true
  button.title = '选择代码语言'
  const menu = document.createElement('div')
  menu.className = 'vditor-code-lang__menu'
  menu.hidden = true
  root.appendChild(button)
  root.appendChild(menu)

  let anchorNode = null
  let hideTimer = 0

  const codeBlocks = () => Array.from(root.querySelectorAll('.vditor-ir__node[data-type="code-block"]'))

  const langOf = (node) => {
    const info = node.querySelector('.vditor-ir__marker--info')
    if (!info) return ''
    return info.textContent.replace(/[\u200b\ufeff]/g, '').trim()
  }

  const place = () => {
    if (!anchorNode || !root.contains(anchorNode)) return
    const rect = anchorNode.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    const buttonRect = button.getBoundingClientRect()
    const left = Math.min(
      rect.right - rootRect.left - buttonRect.width - 10,
      root.clientWidth - buttonRect.width - 8
    )
    const top = rect.bottom - rootRect.top - buttonRect.height - 4
    button.style.left = `${Math.max(left, 8)}px`
    button.style.top = `${Math.max(top, 8)}px`
    // 单行代码块高度不够，Vditor 的复制按钮也落在右下角，这里把语言按钮往左让开
    const copy = anchorNode.querySelector('.vditor-copy span')
    if (copy) {
      const copyRect = copy.getBoundingClientRect()
      const langRect = button.getBoundingClientRect()
      const overlapped =
        copyRect.width > 0 &&
        !(
          langRect.right <= copyRect.left ||
          copyRect.right <= langRect.left ||
          langRect.bottom <= copyRect.top ||
          copyRect.bottom <= langRect.top
        )
      if (overlapped) {
        const shifted = copyRect.left - rootRect.left - langRect.width - 6
        button.style.left = `${Math.max(shifted, 8)}px`
      }
    }
  }

  const hideMenu = () => {
    menu.hidden = true
    menu.innerHTML = ''
  }

  const hideButton = () => {
    button.hidden = true
    anchorNode = null
    hideMenu()
  }

  const setLanguage = (lang) => {
    if (!anchorNode) return
    const index = codeBlocks().indexOf(anchorNode)
    if (index < 0) return
    const markdown = vditor.getValue()
    const next = replaceFenceLang(markdown, index, lang)
    hideMenu()
    hideButton()
    if (next === markdown) return
    const pre = internal.ir.element
    const savedScroll = pre.scrollTop
    vditor.setValue(next, false)
    if (internal.options && typeof internal.options.input === 'function') {
      internal.options.input(next)
    }
    pre.scrollTop = savedScroll
  }

  const openMenu = () => {
    if (!anchorNode) return
    const current = langOf(anchorNode)
    menu.innerHTML = ''
    CODE_LANGS.forEach((lang) => {
      const item = document.createElement('button')
      item.type = 'button'
      item.className = 'vditor-code-lang__item'
      item.textContent = lang
      if (lang === current) item.classList.add('is-current')
      item.addEventListener('mousedown', (event) => {
        event.preventDefault()
        event.stopPropagation()
        setLanguage(lang)
      })
      menu.appendChild(item)
    })
    menu.hidden = false
    const rect = button.getBoundingClientRect()
    const rootRect = root.getBoundingClientRect()
    const menuWidth = menu.offsetWidth || 220
    const left = Math.min(
      rect.left - rootRect.left + rect.width - menuWidth,
      root.clientWidth - menuWidth - 8
    )
    menu.style.left = `${Math.max(left, 8)}px`
    menu.style.top = `${Math.min(rect.bottom - rootRect.top + 4, root.clientHeight - menu.offsetHeight - 8)}px`
  }

  const showFor = (target) => {
    if (internal.currentMode !== 'ir') return
    if (!target || !target.closest) return
    if (target.closest('.vditor-code-lang') || target.closest('.vditor-code-lang__menu')) {
      window.clearTimeout(hideTimer)
      return
    }
    const node = target.closest('.vditor-ir__node[data-type="code-block"]')
    if (!node || !root.contains(node)) {
      if (anchorNode) {
        window.clearTimeout(hideTimer)
        hideTimer = window.setTimeout(() => {
          if (!menu.hidden) return
          hideButton()
        }, 400)
      }
      return
    }
    window.clearTimeout(hideTimer)
    // 正在语言标记里输入语言时只显示那枚角标（它会出现在同样的右下角位置），
    // 避免和语言按钮重叠成两个「js」
    const info = node.querySelector('.vditor-ir__marker--info')
    const selection = window.getSelection()
    const anchor = selection && selection.rangeCount ? selection.getRangeAt(0).startContainer : null
    if (info && anchor && info.contains(anchor)) {
      hideButton()
      return
    }
    anchorNode = node
    button.textContent = langOf(node) || '语言'
    button.hidden = false
    place()
  }

  const offOver = on(root, 'mouseover', (event) => showFor(event.target))
  const offLeave = on(button, 'mouseenter', () => window.clearTimeout(hideTimer))
  const offButtonLeave = on(button, 'mouseleave', () => {
    window.clearTimeout(hideTimer)
    hideTimer = window.setTimeout(() => {
      if (!menu.hidden) return
      hideButton()
    }, 350)
  })
  const offMenuLeave = on(menu, 'mouseleave', () => {
    window.clearTimeout(hideTimer)
    hideTimer = window.setTimeout(hideMenu, 250)
  })
  const offClick = on(button, 'mousedown', (event) => {
    event.preventDefault()
    if (menu.hidden) openMenu()
    else hideMenu()
  })
  const offOutside = on(document, 'mousedown', (event) => {
    if (!menu.hidden && !menu.contains(event.target) && event.target !== button) hideMenu()
  })
  const offScroll = on(internal.ir.element, 'scroll', () => {
    if (!button.hidden) {
      hideMenu()
      hideButton()
    }
  })
  const offResize = on(window, 'resize', () => {
    if (!button.hidden) place()
  })
  const offMode = on(root, 'vditor-mode-change', hideButton)

  return () => {
    offOver()
    offLeave()
    offButtonLeave()
    offMenuLeave()
    offClick()
    offOutside()
    offScroll()
    offResize()
    offMode()
    window.clearTimeout(hideTimer)
    button.remove()
    menu.remove()
  }
}

/** 是否在代码块里（返回代码块节点） */
const codeBlockOf = (node) => {
  const element = node && (node.nodeType === 1 ? node : node.parentElement)
  return element && element.closest ? element.closest('.vditor-ir__node[data-type="code-block"]') : null
}

/**
 * 行内标记即时渲染（Typora 手感）：
 * Vditor 在 IR 模式下输入完 `**加粗**`、`` `代码` `` 这类行内元素后，会把节点的
 * 源标记（`**`）保持展开，直到再按空格/方向键才收起，看起来像「渲染不及时」。
 * 这里补两处：
 * 1. 输入完成后光标已经离开节点的，立即收起；
 * 2. 选中文字后用加粗/斜体/删除线/行内代码（快捷键或「格式」菜单）时，也立即收起，
 *    Typora 里选中文字加粗后看到的是粗体本身，而不是 `**文字**`。
 * 只处理行内节点（没有 data-block），避免影响代码块/表格。
 */
function installInlineAutoRender(root, internal) {
  const collapseInactiveNodes = () => {
    if (internal.currentMode !== 'ir') return
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return
    const startContainer = selection.getRangeAt(0).startContainer
    internal.ir.element.querySelectorAll('.vditor-ir__node--expand').forEach((node) => {
      if (node.hasAttribute('data-block')) return
      if (node.contains(startContainer)) return
      node.classList.remove('vditor-ir__node--expand')
    })
  }

  /** 收紧选中文字所在的行内节点（选区必须已经覆盖了内容，空选不改） */
  const collapseSelectedNodes = () => {
    if (internal.currentMode !== 'ir') return
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || selection.isCollapsed) return
    const range = selection.getRangeAt(0)
    internal.ir.element.querySelectorAll('.vditor-ir__node--expand').forEach((node) => {
      if (node.hasAttribute('data-block')) return
      if (!node.contains(range.startContainer) || !node.contains(range.endContainer)) return
      node.classList.remove('vditor-ir__node--expand')
    })
  }

  const FORMAT_BUTTONS = ['bold', 'italic', 'strike', 'inline-code']
  const scheduleCollapseSelected = () => window.setTimeout(collapseSelectedNodes, 0)

  const offInput = on(internal.ir.element, 'input', (event) => {
    if (event.isComposing) return
    collapseInactiveNodes()
  })
  // 中文输入法走 compositionend，Vditor 在这之后才重渲染
  const offComposition = on(internal.ir.element, 'compositionend', () => {
    window.setTimeout(collapseInactiveNodes, 0)
  })
  // 快捷键：Vditor 在 keydown 里处理 ⌘/Ctrl + B/I/U
  const offKeydown = on(root, 'keydown', (event) => {
    const mod = isMac() ? event.metaKey : event.ctrlKey
    if (!mod || event.altKey || event.shiftKey) return
    const key = (event.key || '').toLowerCase()
    if (key !== 'b' && key !== 'i' && key !== 'u') return
    scheduleCollapseSelected()
  })
  // 「格式」菜单是点击隐藏工具栏里的按钮实现的
  const offClick = on(root, 'click', (event) => {
    const target = event.target
    const button = target && target.closest ? target.closest('.vditor-toolbar button') : null
    if (!button) return
    if (!FORMAT_BUTTONS.includes(button.getAttribute('data-type'))) return
    scheduleCollapseSelected()
  })

  return () => {
    offInput()
    offComposition()
    offKeydown()
    offClick()
  }
}

/**
 * 代码块语言行（Vditor 的 `.vditor-ir__marker--info`）只在正在输入语言时显示。
 * Typora 的语言标识只在代码块右下角出现（对应这里的 .vditor-code-lang 按钮），
 * 代码块上方不应该多出一行「js」。不能直接用 CSS 永久隐藏：新建代码块时光标
 * 会落在这行里，display:none 会导致语言被当成代码内容。所以按光标位置切换。
 */
function installCodeBlockLangMarker(root, internal) {
  const INFO = '.vditor-ir__node[data-type="code-block"] > .vditor-ir__marker--info'
  let frame = 0

  const sync = () => {
    frame = 0
    if (internal.currentMode !== 'ir') return
    const selection = window.getSelection()
    const anchor = selection && selection.rangeCount ? selection.getRangeAt(0).startContainer : null
    internal.ir.element.querySelectorAll(INFO).forEach((marker) => {
      marker.classList.toggle('is-lang-idle', !(anchor && marker.contains(anchor)))
    })
  }

  const schedule = () => {
    if (frame) return
    frame = window.requestAnimationFrame(sync)
  }

  const offSelection = on(document, 'selectionchange', schedule)
  const offInput = on(internal.ir.element, 'input', schedule)
  const offClick = on(root, 'click', schedule)

  return () => {
    offSelection()
    offInput()
    offClick()
    if (frame) window.cancelAnimationFrame(frame)
  }
}

/**
 * 代码块里 Tab / Shift+Tab 缩进；Markdown 里「表格源码 + 回车」转成真正的表格。
 */
function installEditingShortcuts(root, internal, vditor) {
  const isSeparatorRow = (text) =>
    /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?$/.test(text) && text.includes('-')
  const isHeaderRow = (text) => /^\|.*\|$/.test(text) && text.includes('|')

  const convertTable = (block) => {
    const header = block.previousElementSibling
    if (!header || header.tagName !== 'P') return false
    const headerText = (header.textContent || '').trim()
    const separatorText = (block.textContent || '').trim()
    if (!isHeaderRow(headerText) || !isSeparatorRow(separatorText)) return false
    const columns = headerText
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .length
    if (columns < 1) return false
    const markdown = vditor.getValue()
    const needle = `${headerText}\n\n${separatorText}`
    if (!markdown.includes(needle)) return false
    const emptyRow = `|${Array.from({ length: columns }, () => '  ').join('|')}|`
    const next = markdown.replace(needle, `${headerText}\n${separatorText}\n${emptyRow}`)
    const pre = internal.ir.element
    const savedScroll = pre.scrollTop
    vditor.setValue(next, false)
    if (internal.options && typeof internal.options.input === 'function') {
      internal.options.input(next)
    }
    window.setTimeout(() => {
      pre.scrollTop = savedScroll
      // 定位到刚生成的那张表（按 Markdown 里的表格顺序取 DOM 表格），把光标放进第一格
      const blocks = findTableBlocks(next.split('\n'))
      const index = blocks.findIndex((block) => {
        const lines = next.split('\n')
        return lines[block.start].trim() === headerText && lines[block.start + 1].trim() === separatorText
      })
      const tables = pre.querySelectorAll('table')
      const targetTable = tables[index >= 0 ? index : tables.length - 1]
      const cell = targetTable && targetTable.querySelector('tbody tr td')
      if (!cell) return
      pre.focus()
      const range = document.createRange()
      range.selectNodeContents(cell)
      range.collapse(true)
      const selection = window.getSelection()
      selection.removeAllRanges()
      selection.addRange(range)
    }, 40)
    return true
  }

  const insertIndent = (spaces) => {
    document.execCommand('insertText', false, ' '.repeat(spaces))
  }

  /** 把只有列表标记的段落转成真正的列表（Vditor 只有回车才转，这里补上空格触发） */
  const convertList = (block, ordered, startNumber) => {
    const selection = window.getSelection()
    if (!selection) return
    const range = document.createRange()
    range.selectNodeContents(block)
    selection.removeAllRanges()
    selection.addRange(range)
    document.execCommand('delete')
    const item = internal.toolbar && internal.toolbar.elements[ordered ? 'ordered-list' : 'list']
    const action = item && item.children[0]
    if (action) action.click()
    // Vditor 新建的有序列表固定从 1 开始；用户手写「2. + 空格」时保留起始序号，
    // 否则被其他内容隔断的列表会重新从 1 编号
    if (ordered && startNumber > 1) {
      applyListStart(startNumber)
    }
  }

  /**
   * 把刚生成的有序列表改成从指定序号开始。
   * 需要同时改 ol 的 start / data-marker 和每个 li 的 data-marker：
   * Vditor 用 li 的 data-marker 生成 Markdown，只改 start 会在保存时丢序号。
   */
  const applyListStart = (startNumber) => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return
    const anchor = selection.getRangeAt(0).startContainer
    const element = anchor && (anchor.nodeType === 1 ? anchor : anchor.parentElement)
    const list = element && element.closest ? element.closest('ol') : null
    if (!list || !internal.ir.element.contains(list)) return
    list.setAttribute('start', String(startNumber))
    list.setAttribute('data-marker', `${startNumber}.`)
    Array.from(list.children).forEach((child, index) => {
      if (child.tagName === 'LI') child.setAttribute('data-marker', `${startNumber + index}.`)
    })
    // 让 v-model / 字数统计立刻拿到新 Markdown
    if (internal.options && typeof internal.options.input === 'function') {
      internal.options.input(vditor.getValue())
    }
  }

  const outdent = () => {
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount) return
    const range = selection.getRangeAt(0)
    const node = range.startContainer
    if (node.nodeType !== 3) return
    const text = node.nodeValue || ''
    const lineStart = text.lastIndexOf('\n', Math.max(range.startOffset - 1, 0)) + 1
    const indent = /^ */.exec(text.slice(lineStart))[0].length
    if (!indent) return
    const remove = Math.min(indent, 4)
    const target = document.createRange()
    target.setStart(node, lineStart)
    target.setEnd(node, lineStart + remove)
    selection.removeAllRanges()
    selection.addRange(target)
    document.execCommand('delete')
  }

  const onKeydown = (event) => {
    if (internal.currentMode !== 'ir') return
    if (event.ctrlKey || event.metaKey || event.altKey) return

    if (event.key === 'Tab') {
      const selection = window.getSelection()
      if (!selection || !selection.rangeCount) return
      const block = codeBlockOf(selection.anchorNode)
      if (!block) return
      event.preventDefault()
      event.stopPropagation()
      if (event.shiftKey) outdent()
      else insertIndent(4)
      return
    }

    if (event.key === ' ' || event.key === 'Spacebar') {
      const selection = window.getSelection()
      if (!selection || !selection.rangeCount) return
      const anchor = selection.anchorNode
      const element = anchor && (anchor.nodeType === 1 ? anchor : anchor.parentElement)
      const block = element && element.closest ? element.closest('p') : null
      if (!block || !internal.ir.element.contains(block)) return
      // 已经在列表项里时不接管：交给 Vditor 的列表逻辑，否则会把当前列表改坏
      if (element.closest('li')) return
      const text = (block.textContent || '').trim()
      const orderedMatch = /^(\d+)[.)]$/.exec(text)
      const ordered = Boolean(orderedMatch)
      const unordered = /^[-*+]$/.test(text)
      if (!ordered && !unordered) return
      // 只在标记位于行尾时转换，避免正文里的短横线被误转
      if (selection.focusOffset < (anchor.nodeValue || '').length) return
      event.preventDefault()
      event.stopPropagation()
      convertList(block, ordered, ordered ? parseInt(orderedMatch[1], 10) : 0)
      return
    }

    if (event.key === 'Enter' && !event.shiftKey) {
      const selection = window.getSelection()
      if (!selection || !selection.rangeCount) return
      const anchor = selection.anchorNode
      const element = anchor && (anchor.nodeType === 1 ? anchor : anchor.parentElement)
      const block = element && element.closest ? element.closest('p') : null
      if (!block || !internal.ir.element.contains(block)) return
      const blockText = (block.textContent || '').trim()
      // 表格源码：上一行是表头、当前行是分隔行时才转换（Vditor 会在表头换行时就抢跑成表格）
      if (convertTable(block)) {
        event.preventDefault()
        event.stopPropagation()
        return
      }
      // 表头行先按普通换行处理，等分隔行输入完再一起转成表格
      if (isHeaderRow(blockText) && !isSeparatorRow(blockText)) {
        event.preventDefault()
        event.stopPropagation()
        document.execCommand('insertParagraph')
      }
    }
  }

  // 捕获阶段挂在 .vditor 上，先于 Vditor 自己的 keydown 处理（默认行为与插入都被我们接管）
  return on(root, 'keydown', onKeydown, true)
}

/**
 * 水平分隔线（hr）在 IR 模式下只是一条不可编辑的线：
 * Vditor 只在 Firefox 里支持「光标在 hr 后一段开头按 Backspace 删除」，
 * Chromium 下既点不中也没法删。这里补上：
 * 1. 单击分隔线选中（高亮），Backspace / Delete 删除；
 * 2. 光标在 hr 后一段开头按 Backspace、在 hr 前一段末尾按 Delete 也能删除。
 */
function installHrInteractions(root, internal, vditor) {
  let selectedHr = null

  const clearSelected = () => {
    if (!selectedHr) return
    selectedHr.classList.remove('vditor-hr--selected')
    selectedHr = null
  }

  const placeCaret = (block, atStart) => {
    if (!block) return
    const range = document.createRange()
    const target = atStart ? block.firstChild : block.lastChild
    if (target && target.nodeType === 3) {
      range.setStart(target, atStart ? 0 : (target.nodeValue || '').length)
    } else {
      range.selectNodeContents(block)
      range.collapse(atStart)
    }
    const selection = window.getSelection()
    selection.removeAllRanges()
    selection.addRange(range)
    internal.ir.element.focus()
  }

  /** 删除分隔线：光标落到后一段开头，没有后一段就落到前一段末尾 */
  const deleteHr = (hr) => {
    if (!hr || !internal.ir.element.contains(hr)) return
    const prev = hr.previousElementSibling
    const next = hr.nextElementSibling
    clearSelected()
    hr.remove()
    if (next) {
      placeCaret(next, true)
    } else if (prev) {
      placeCaret(prev, false)
    } else {
      const paragraph = document.createElement('p')
      paragraph.setAttribute('data-block', '0')
      internal.ir.element.appendChild(paragraph)
      placeCaret(paragraph, true)
    }
    // hr 不是可编辑节点，Vditor 不会自己感知；这里直接同步 Markdown 与撤销栈
    if (internal.options && typeof internal.options.input === 'function') {
      internal.options.input(vditor.getValue())
    }
    if (internal.undo && typeof internal.undo.addToUndoStack === 'function') {
      internal.undo.addToUndoStack(internal)
    }
  }

  const selectHr = (hr) => {
    clearSelected()
    selectedHr = hr
    hr.classList.add('vditor-hr--selected')
    const next = hr.nextElementSibling
    const prev = hr.previousElementSibling
    if (next) placeCaret(next, true)
    else if (prev) placeCaret(prev, false)
  }

  // 选中分隔线后按键要能冒泡到 root，所以先把光标放进相邻段落再标记选中
  const onHrMouse = (event) => {
    if (internal.currentMode !== 'ir') return
    const target = event.target
    const hr = target && target.tagName === 'HR' && internal.ir.element.contains(target) ? target : null
    if (!hr) return
    event.preventDefault()
    event.stopPropagation()
    selectHr(hr)
  }
  const offDown = on(root, 'mousedown', onHrMouse, true)
  const offClick = on(root, 'click', onHrMouse, true)
  const offDocDown = on(document, 'mousedown', clearSelected)
  const offInput = on(internal.ir.element, 'input', clearSelected)

  const adjacentHr = (range, key) => {
    const start = range.startContainer
    const element = start && (start.nodeType === 1 ? start : start.parentElement)
    const block = element && element.closest ? element.closest('p[data-block]') : null
    if (!block || !internal.ir.element.contains(block)) return null
    const before = document.createRange()
    before.selectNodeContents(block)
    before.setEnd(range.startContainer, range.startOffset)
    const after = document.createRange()
    after.selectNodeContents(block)
    after.setStart(range.startContainer, range.startOffset)
    const blank = (text) => text.replace(/[\u200b\s]/g, '') === ''
    if (key === 'Backspace') {
      if (!blank(before.toString())) return null
      const prev = block.previousElementSibling
      return prev && prev.tagName === 'HR' ? prev : null
    }
    if (!blank(after.toString())) return null
    const next = block.nextElementSibling
    return next && next.tagName === 'HR' ? next : null
  }

  const onKeydown = (event) => {
    if (internal.currentMode !== 'ir') return
    if (event.key === 'Escape' || event.key.indexOf('Arrow') > -1) {
      clearSelected()
      return
    }
    if (event.key !== 'Backspace' && event.key !== 'Delete') return
    const selection = window.getSelection()
    if (!selection || !selection.rangeCount || !selection.isCollapsed) return
    const hr = selectedHr || adjacentHr(selection.getRangeAt(0), event.key)
    if (!hr) return
    event.preventDefault()
    event.stopPropagation()
    deleteHr(hr)
  }
  const offKey = on(root, 'keydown', onKeydown, true)

  return () => {
    offDown()
    offClick()
    offDocDown()
    offInput()
    offKey()
  }
}

/**
 * 代码块在编辑态也显示高亮后的样子（CSS 里用预览层 + 透明源码层叠加实现）。
 * 中文输入法组词时透明文字看不到候选，这里在组合期给编辑器加一个 class，
 * 让源码文字临时显示、预览文字隐藏，组合结束再切回高亮层。
 */
function installCodeBlockComposition(root, internal) {
  const start = () => root.classList.add('is-code-composing')
  const end = () => root.classList.remove('is-code-composing')
  const offStart = on(internal.ir.element, 'compositionstart', start)
  const offEnd = on(internal.ir.element, 'compositionend', end)
  return () => {
    offStart()
    offEnd()
    root.classList.remove('is-code-composing')
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
    installCodeLanguage(root, internal, vditor),
    installCodeBlockLangMarker(root, internal),
    installCodeBlockComposition(root, internal),
    installInlineAutoRender(root, internal),
    installEditingShortcuts(root, internal, vditor),
    installHrInteractions(root, internal, vditor)
  ]
  return () => disposers.forEach((dispose) => dispose())
}
