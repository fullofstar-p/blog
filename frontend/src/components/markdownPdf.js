/**
 * 浏览器端生成 PDF 并直接下载（不弹打印对话框）。
 *
 * 实现方式：把与「导出 HTML」相同的正文排版渲染到离屏纸张容器里，
 * 按块（标题、段落、代码块、表格…）分页，再用 SVG <foreignObject> 交给浏览器
 * 原生渲染成图片、jsPDF 拼成 A4。中文字体由系统字体参与渲染，所以不依赖
 * 服务端和字体文件；缺点是文字是图片。
 *
 * 长文档（几百页）的优化：
 * - 每批把多页拼进同一个 SVG、只栅格化一次，再把长图按页裁开；
 *   300 页从 300 次逐页 html2canvas 降到约 50 批原生渲染。
 * - 页数越多自动降低渲染倍率与 JPEG 质量，控制内存、编码时间和文件体积。
 * - html2canvas 仅作为 SVG foreignObject 不可用时的兜底，按需动态加载。
 *
 * jspdf 也按需动态加载，不进入编辑器首屏包体。
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
// 分页时留 10px 余量，避免 clone 到固定高度容器后最后一行被裁掉
const SAFE_PAGE_CONTENT_HEIGHT_PX = PAGE_CONTENT_HEIGHT_PX - 10
// 一批最多渲染多少 CSS 像素高度；6 页约 6990px，scale=2 时位图约 88MB
const MAX_CHUNK_CSS_HEIGHT = 7000

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

/**
 * 页数越多，单页像素与 JPEG 质量适当降低：
 * 300 页左右的文档如果仍按 2x / 0.9 导出，光 canvas 绘制和 JPEG 编码就要几分钟。
 */
function pickQuality(pageCount) {
  if (pageCount <= 10) return { scale: 2, quality: 0.9 }
  if (pageCount <= 40) return { scale: 1.75, quality: 0.88 }
  if (pageCount <= 120) return { scale: 1.5, quality: 0.86 }
  return { scale: 1.35, quality: 0.84 }
}

function ensurePdfStyle() {
  const existing = document.getElementById(PDF_STYLE_ID)
  if (existing) return existing
  const style = document.createElement('style')
  style.id = PDF_STYLE_ID
  style.textContent = pdfStyleCss()
  document.head.appendChild(style)
  return style
}

function pdfStyleCss() {
  return [
    pageTypographyCss('.markdown-pdf-surface'),
    codeThemeCss(),
    `.markdown-pdf-surface { box-sizing: border-box; background-color: #ffffff; }`,
    `.markdown-pdf-surface .markdown-pdf-page {
       box-sizing: border-box;
       margin: 0;
       padding: 0;
       overflow: hidden;
       background-color: #ffffff;
       display: flow-root;
    }`,
    `.markdown-pdf-surface .markdown-pdf-page > :first-child { margin-top: 0; }`,
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
 * 把正文里的图片先转成 data URL 再渲染：
 * - 跨域图片（MinIO 默认没有 CORS 头）fetch 会失败，改成文字占位符，避免画布被污染；
 * - 能取到的图片内联后，SVG/画布都能正常出图。
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
 * 返回 [{ blocks, height }]：height 是这一页在离屏容器里的实际高度。
 */
function paginateBlocks(blocks) {
  const pages = []
  let current = []
  let pageTop = 0
  let used = 0

  const flush = () => {
    if (current.length) pages.push({ blocks: current, height: PAGE_CONTENT_HEIGHT_PX })
    current = []
    used = 0
  }

  blocks.forEach((block) => {
    if (block.height > SAFE_PAGE_CONTENT_HEIGHT_PX) {
      flush()
      pages.push({ blocks: [block], height: block.height })
      return
    }
    if (current.length && used + block.height > SAFE_PAGE_CONTENT_HEIGHT_PX) {
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

/**
 * 把若干页序列化成 XHTML（连同本次导出用的 CSS），塞进 SVG <foreignObject>，
 * 交给浏览器原生渲染。比 html2canvas 逐元素读取计算样式快一个数量级。
 */
function pagesToXhtml(pageGroups) {
  const wrapper = document.createElement('div')
  wrapper.className = 'markdown-pdf-surface'
  const style = document.createElement('style')
  style.textContent = pdfStyleCss()
  wrapper.appendChild(style)
  pageGroups.forEach((page) => {
    const pageElement = document.createElement('div')
    pageElement.className = 'markdown-pdf-page'
    pageElement.style.width = `${PAGE_WIDTH_PX}px`
    pageElement.style.height = `${page.height}px`
    page.blocks.forEach((block) => {
      pageElement.appendChild(block.element.cloneNode(true))
    })
    wrapper.appendChild(pageElement)
  })
  return new XMLSerializer().serializeToString(wrapper)
}

/** SVG foreignObject → canvas，浏览器负责排版和绘制；失败时由调用方回退 html2canvas */
function svgToCanvas(pageGroups, scale) {
  return new Promise((resolve, reject) => {
    const totalHeight = pageGroups.reduce((sum, page) => sum + page.height, 0)
    const xhtml = pagesToXhtml(pageGroups)
    const svg =
      `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH_PX}" height="${totalHeight}" ` +
      `viewBox="0 0 ${PAGE_WIDTH_PX} ${totalHeight}">` +
      `<foreignObject x="0" y="0" width="100%" height="100%">${xhtml}</foreignObject></svg>`
    // 用 data URL 而不是 blob URL：部分 Chromium 版本在绘制 foreignObject 的 blob SVG 时会污染画布
    const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    const image = new Image()
    let settled = false
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      fn(value)
    }
    window.setTimeout(() => finish(reject, new Error('SVG 渲染超时')), 15000)
    image.onerror = () => finish(reject, new Error('SVG 渲染失败'))
    image.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = Math.round(PAGE_WIDTH_PX * scale)
        canvas.height = Math.round(totalHeight * scale)
        const context = canvas.getContext('2d')
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        // 跨域资源会让画布被污染（后面 toDataURL 会失败），这里提前发现并回退
        context.getImageData(0, 0, 1, 1)
        finish(resolve, canvas)
      } catch (error) {
        finish(reject, error)
      }
    }
    image.src = url
  })
}

/** html2canvas 兜底：SVG foreignObject 在个别浏览器/安全策略下不可用时使用 */
async function renderPagesWithHtml2canvas(pageGroups, scale) {
  ensurePdfStyle()
  const { default: html2canvas } = await import('html2canvas')
  const container = document.createElement('div')
  container.className = 'markdown-pdf-surface'
  container.style.cssText = SURFACE_STYLE

  pageGroups.forEach((page) => {
    const pageElement = document.createElement('div')
    pageElement.className = 'markdown-pdf-page'
    pageElement.style.cssText = `width: ${PAGE_WIDTH_PX}px; height: ${page.height}px;`
    page.blocks.forEach((block) => {
      pageElement.appendChild(block.element.cloneNode(true))
    })
    container.appendChild(pageElement)
  })

  document.body.appendChild(container)
  try {
    await waitForImages(container)
    return await html2canvas(container, {
      scale,
      backgroundColor: '#ffffff',
      // 图片已经全部内联成 data URL，不需要再走 CORS 加载
      useCORS: false,
      logging: false
    })
  } finally {
    container.remove()
  }
}

async function renderPages(pageGroups, scale) {
  try {
    return await svgToCanvas(pageGroups, scale)
  } catch (error) {
    console.warn('[markdown] SVG 渲染 PDF 失败，回退 html2canvas', error)
    return renderPagesWithHtml2canvas(pageGroups, scale)
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
  const surface = createSurface(bodyHtml)
  try {
    await inlineImages(surface)
    await waitForImages(surface)
    const blocks = measureBlocks(surface)
    if (!blocks.length) throw new Error('正文为空，暂时没有可导出的内容')
    const pages = paginateBlocks(blocks)
    const totalPages = pages.length
    const { scale, quality } = pickQuality(totalPages)

    const { jsPDF } = await import('jspdf')
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true })
    pdf.setProperties({ title: title || '未命名文档', creator: 'blog-markdown-export' })

    const pageWidthPx = Math.round(PAGE_WIDTH_PX * scale)
    const pageHeightPx = Math.round(PAGE_CONTENT_HEIGHT_PX * scale)
    // 复用一张页面画布，避免给 300 页分配 300 个 canvas
    const pageCanvas = document.createElement('canvas')
    pageCanvas.width = pageWidthPx
    pageCanvas.height = pageHeightPx
    const pageContext = pageCanvas.getContext('2d')

    let pdfPageIndex = 0
    let renderedPages = 0

    const addPageImage = (canvas, imageHeightPx) => {
      if (pdfPageIndex > 0) pdf.addPage()
      pdfPageIndex += 1
      const ratio = imageHeightPx / canvas.width
      let width = CONTENT_WIDTH_MM
      let height = width * ratio
      if (height > CONTENT_HEIGHT_MM) {
        height = CONTENT_HEIGHT_MM
        width = height / ratio
      }
      const x = (PAGE_WIDTH_MM - width) / 2
      pdf.addImage(canvas.toDataURL('image/jpeg', quality), 'JPEG', x, PAGE_MARGIN_MM, width, height)
    }

    // 普通页按批渲染；超长块单独渲染（高度超过一页，等比缩放到页面内）
    const chunkPages = Math.max(1, Math.floor(MAX_CHUNK_CSS_HEIGHT / PAGE_CONTENT_HEIGHT_PX))
    let index = 0
    while (index < totalPages) {
      const page = pages[index]
      if (page.height > PAGE_CONTENT_HEIGHT_PX) {
        const tallCanvas = await renderPages([page], scale)
        if (onProgress) onProgress(renderedPages + 1, totalPages)
        addPageImage(tallCanvas, tallCanvas.height)
        renderedPages += 1
        await nextPaint()
        index += 1
        continue
      }

      const group = []
      while (index < totalPages && group.length < chunkPages && pages[index].height <= PAGE_CONTENT_HEIGHT_PX) {
        group.push(pages[index])
        index += 1
      }

      if (onProgress) onProgress(renderedPages + 1, totalPages)
      await nextPaint()
      const chunkCanvas = await renderPages(group, scale)
      const sourceScale = chunkCanvas.width / PAGE_WIDTH_PX
      let sourceCssOffset = 0

      for (const pageItem of group) {
        const sourceY = Math.round(sourceCssOffset * sourceScale)
        const sourceHeight = Math.min(
          Math.round(pageItem.height * sourceScale),
          chunkCanvas.height - sourceY
        )
        pageContext.clearRect(0, 0, pageWidthPx, pageHeightPx)
        pageContext.drawImage(
          chunkCanvas,
          0,
          sourceY,
          pageWidthPx,
          sourceHeight,
          0,
          0,
          pageWidthPx,
          pageHeightPx
        )
        addPageImage(pageCanvas, pageHeightPx)
        sourceCssOffset += pageItem.height
        renderedPages += 1
        if (onProgress) onProgress(renderedPages, totalPages)
      }
      await nextPaint()

      // 及时释放批次大画布，避免几百页时内存持续上涨
      chunkCanvas.width = 0
      chunkCanvas.height = 0
    }

    pdf.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`)
    return totalPages
  } finally {
    surface.remove()
    removePdfStyle()
  }
}
