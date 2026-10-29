/**
 * 浏览器端生成 PDF 并直接下载（不弹打印对话框）。
 *
 * 实现方式：把与「导出 HTML」相同的正文排版渲染到离屏纸张容器里，
 * 按块（标题、段落、代码块、表格…）分页，逐页用 html2canvas 截图，
 * 再用 jsPDF 按 A4 尺寸拼成 PDF。中文字体由系统字体参与渲染，所以不依赖
 * 服务端和字体文件；缺点是 PDF 里的文字是图片，不能选中复制。
 *
 * jspdf / html2canvas 都按需动态加载，不进入编辑器首屏包体。
 */
import { codeThemeCss, pageTypographyCss } from '@/components/markdownIO'

const PDF_STYLE_ID = 'markdown-pdf-style'
// A4 宽度按 96dpi = 794px；页面四周留 12mm 边距
const PAGE_WIDTH_PX = 794
const PAGE_WIDTH_MM = 210
const PAGE_HEIGHT_MM = 297
const PAGE_MARGIN_MM = 12
const CONTENT_WIDTH_MM = PAGE_WIDTH_MM - PAGE_MARGIN_MM * 2
const CONTENT_HEIGHT_MM = PAGE_HEIGHT_MM - PAGE_MARGIN_MM * 2
// 内容宽度 186mm 对应 794px，换算出一页最多能放多少 px 内容
const PX_PER_MM = PAGE_WIDTH_PX / CONTENT_WIDTH_MM
const PAGE_CONTENT_HEIGHT_PX = Math.floor(CONTENT_HEIGHT_MM * PX_PER_MM)

const SURFACE_STYLE = [
  'position: absolute',
  'left: -12000px',
  'top: 0',
  `width: ${PAGE_WIDTH_PX}px`,
  'padding: 0',
  'margin: 0',
  'background-color: #ffffff',
  'display: flow-root',
  'z-index: -1'
].join(';')

const nextPaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

function ensurePdfStyle() {
  const existing = document.getElementById(PDF_STYLE_ID)
  if (existing) return existing
  const style = document.createElement('style')
  style.id = PDF_STYLE_ID
  style.textContent = [
    pageTypographyCss('.markdown-pdf-surface'),
    codeThemeCss(),
    `.markdown-pdf-surface { box-sizing: border-box; background-color: #ffffff; }`,
    // 代码块在 PDF 里换成折行，避免长行被裁掉；宽表格允许单元格换行
    `.markdown-pdf-surface pre { white-space: pre-wrap; word-break: break-word; }`,
    `.markdown-pdf-surface table { width: 100%; table-layout: auto; }`,
    `.markdown-pdf-surface td,
     .markdown-pdf-surface th { overflow-wrap: anywhere; }`,
    `.markdown-pdf-surface .markdown-pdf-missing-image {
       display: inline-block;
       padding: 6px 10px;
       border: 1px dashed #cfc7b6;
       border-radius: 4px;
       color: #8c8578;
       font-size: 13px;
    }`
  ].join('\n')
  document.head.appendChild(style)
  return style
}

function removePdfStyle() {
  const style = document.getElementById(PDF_STYLE_ID)
  if (style) style.remove()
}

function createSurface(bodyHtml) {
  const surface = document.createElement('div')
  surface.className = 'markdown-pdf-surface'
  surface.style.cssText = SURFACE_STYLE
  surface.innerHTML = bodyHtml
  document.body.appendChild(surface)
  return surface
}

function readAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error || new Error('读取图片失败'))
    reader.readAsDataURL(blob)
  })
}

/**
 * 把正文里的图片先转成 data URL 再截图：
 * - 跨域图片（MinIO 默认没有 CORS 头）fetch 会失败，改成文字占位符，避免整页 taint；
 * - 能取到的图片内联后，html2canvas 画布不会污染，PDF 里也能正常出图。
 */
async function inlineImages(root) {
  const images = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    images.map(async (img) => {
      const src = img.getAttribute('src') || ''
      if (!src || src.startsWith('data:')) return
      try {
        const url = new URL(src, document.baseURI).href
        const response = await fetch(url, { mode: 'cors', credentials: 'omit' })
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        const blob = await response.blob()
        img.src = await readAsDataUrl(blob)
      } catch (error) {
        console.warn('[markdown] PDF 图片无法内联，改为占位符', src, error)
        const alt = img.getAttribute('alt') || img.getAttribute('title') || '图片'
        const placeholder = document.createElement('span')
        placeholder.className = 'markdown-pdf-missing-image'
        placeholder.textContent = `[图片：${alt}]`
        img.replaceWith(placeholder)
      }
    })
  )
}

function waitForImages(root) {
  const pending = Array.from(root.querySelectorAll('img')).filter((img) => !img.complete)
  if (!pending.length) return Promise.resolve()
  return Promise.all(
    pending.map(
      (img) =>
        new Promise((resolve) => {
          const done = () => resolve()
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
          window.setTimeout(done, 3000)
        })
    )
  )
}

/** 量出每个顶层块相对离屏容器的位置与高度，用于按块分页 */
function measureBlocks(surface) {
  const surfaceTop = surface.getBoundingClientRect().top
  return Array.from(surface.children).map((element) => {
    const rect = element.getBoundingClientRect()
    return { element, top: rect.top - surfaceTop, height: rect.height }
  })
}

/**
 * 按块分页：尽量让一页放完整的段落/代码块/表格，不把一行字切成两半；
 * 单个块比整页还高（超长代码块）时单独一页，绘制时等比缩放到页面内。
 */
function paginateBlocks(blocks) {
  const pages = []
  let current = []
  let pageTop = 0
  let used = 0

  const flush = () => {
    if (current.length) pages.push(current)
    current = []
    used = 0
  }

  blocks.forEach((block) => {
    if (block.height > PAGE_CONTENT_HEIGHT_PX) {
      flush()
      pages.push([block])
      return
    }
    if (current.length && used + block.height > PAGE_CONTENT_HEIGHT_PX) {
      flush()
      pageTop = block.top
    }
    if (!current.length) pageTop = block.top
    current.push(block)
    used = block.top + block.height - pageTop
  })
  flush()
  return pages
}

/** 单独渲染一页：克隆这一页的块到新的离屏容器，截图后移除 */
async function renderPage(pageBlocks, html2canvas) {
  const page = document.createElement('div')
  page.className = 'markdown-pdf-surface'
  page.style.cssText = SURFACE_STYLE
  pageBlocks.forEach((block) => {
    page.appendChild(block.element.cloneNode(true))
  })
  document.body.appendChild(page)
  try {
    await waitForImages(page)
    return await html2canvas(page, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false
    })
  } finally {
    page.remove()
  }
}

/**
 * 生成并下载 PDF。
 * @param {{ bodyHtml: string, title?: string, fileName: string, onProgress?: (page:number,total:number)=>void }} options
 * @returns {Promise<number>} 页数
 */
export async function exportMarkdownPdf({ bodyHtml, title = '', fileName, onProgress }) {
  if (!String(bodyHtml || '').trim()) {
    throw new Error('正文为空，暂时没有可导出的内容')
  }
  ensurePdfStyle()
  const surface = createSurface(bodyHtml)
  try {
    await inlineImages(surface)
    await waitForImages(surface)
    const blocks = measureBlocks(surface)
    if (!blocks.length) throw new Error('正文为空，暂时没有可导出的内容')
    const pages = paginateBlocks(blocks)

    const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf')
    ])
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
    pdf.setProperties({ title: title || '未命名文档', creator: 'blog-markdown-export' })

    for (let index = 0; index < pages.length; index += 1) {
      if (onProgress) onProgress(index + 1, pages.length)
      await nextPaint()
      const canvas = await renderPage(pages[index], html2canvas)
      if (index > 0) pdf.addPage()
      const ratio = canvas.height / canvas.width
      let width = CONTENT_WIDTH_MM
      let height = width * ratio
      if (height > CONTENT_HEIGHT_MM) {
        height = CONTENT_HEIGHT_MM
        width = height / ratio
      }
      const x = (PAGE_WIDTH_MM - width) / 2
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', x, PAGE_MARGIN_MM, width, height)
    }

    pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`)
    return pages.length
  } finally {
    surface.remove()
    removePdfStyle()
  }
}
