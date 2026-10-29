/**
 * Markdown 导入 / 导出。
 *
 * 全部在前端完成，不经过后端接口：
 * - 导入：读取本地 .md / .markdown / .mdown / .mkd / .mdx / .txt 文件，
 *   去掉 BOM、统一换行为 LF，再把文本交给编辑器（替换正文或插入光标处）；
 * - 导出：把当前 Markdown 存成本地 .md 文件；导出 HTML 时先用编辑器内部的
 *   lute 把 Markdown 转成 HTML，再用本地 highlight.js 做代码高亮，最后套一层
 *   与阅读页一致的纸张样式，生成可直接双击打开/打印的独立 HTML；
 * - 导出 PDF 走浏览器打印：把同一份 HTML 写进新窗口并调起打印，用户选「另存为 PDF」。
 *
 * 这里只放可在浏览器里复用的纯函数与 DOM 工具，组件负责菜单、对话框与状态。
 */
import hljs from 'highlight.js/lib/common'
import githubCodeCss from 'highlight.js/styles/github.css?raw'

/** 导入文件选择框的 accept（扩展名 + MIME，浏览器会自动取交集） */
export const IMPORT_ACCEPT = [
  '.md',
  '.markdown',
  '.mdown',
  '.mkd',
  '.mdx',
  '.txt',
  'text/markdown',
  'text/x-markdown'
].join(',')

const MARKDOWN_EXTENSION = /\.(md|markdown|mdown|mkd|mdx|txt)$/i

/** 拖拽/选择进来的文件是否是 Markdown 文本 */
export function isMarkdownFile(file) {
  if (!file) return false
  if (MARKDOWN_EXTENSION.test(String(file.name || ''))) return true
  return file.type === 'text/markdown' || file.type === 'text/x-markdown'
}

/**
 * 规范化导入文本：去掉 UTF-8 BOM、CRLF/CR 统一成 LF。
 * Windows 上编辑的 Markdown 大多是 CRLF，直接交给 Vditor 会多出看不见的软换行。
 */
export function normalizeImportText(raw) {
  let text = String(raw == null ? '' : raw)
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  return text.replace(/\r\n?/g, '\n')
}

/** 第一个一级～六级标题（跳过代码块里的 #），没有则返回空字符串 */
export function firstHeading(markdown) {
  const lines = String(markdown || '').split('\n')
  let inFence = false
  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    const match = /^#{1,6}\s+(.+?)\s*#*\s*$/.exec(line)
    if (match) return match[1].replace(/[*_`~[\]]/g, '').trim()
  }
  return ''
}

/**
 * 导入时建议的文档标题：优先用正文里第一个标题，其次用文件名（去掉扩展名）。
 * 只作为「标题输入框为空时」的回填值，最终仍由用户决定。
 */
export function suggestTitle(markdown, fileName) {
  const heading = firstHeading(markdown)
  if (heading) return heading.slice(0, 200)
  const base = String(fileName || '')
    .replace(/\.[^.]+$/, '')
    .trim()
  return base.slice(0, 200)
}

/**
 * 把标题变成安全的文件名：去掉 Windows/macOS 非法字符与首尾的点、空格。
 * @param {string} name
 * @param {string} [fallback]
 */
export function sanitizeFileName(name, fallback = '未命名文档') {
  const cleaned = Array.from(String(name || ''))
    // 控制字符（含换行/制表符）不能进文件名，先统一成连字符
    .map((char) => (char.charCodeAt(0) < 32 ? '-' : char))
    .join('')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
    .replace(/^[.\s]+|[.\s]+$/g, '')
  return cleaned || fallback
}

/** 本地日期戳，形如 20261029，用于没有标题时的默认文件名 */
export function dateStamp(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

/** 触发一次浏览器下载（Blob + 临时 <a download>） */
export function downloadText(filename, text, mime = 'text/markdown;charset=utf-8') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Safari 需要等下载真正开始后再回收 Blob URL
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
  return filename
}

/**
 * 给 Markdown 渲染出的 HTML 代码块加高亮。
 * Vditor 的 lute 只输出 <pre><code class="language-xxx">，高亮由调用方负责；
 * 这里复用阅读页同一套 highlight.js + GitHub 主题，导出文件的配色与站内一致。
 */
export function highlightHtml(html) {
  if (typeof html !== 'string' || !html) return ''
  const holder = document.createElement('div')
  holder.innerHTML = html
  holder.querySelectorAll('pre > code').forEach((code) => {
    const className = code.getAttribute('class') || ''
    const match = /(?:^|\s)language-([\w+#.-]+)/i.exec(className)
    const language = match ? match[1].toLowerCase() : ''
    code.classList.add('hljs')
    if (!language || !hljs.getLanguage(language)) return
    try {
      const source = code.textContent || ''
      code.innerHTML = hljs.highlight(source, { language, ignoreIllegals: true }).value
    } catch (error) {
      console.warn('[markdown] 代码高亮失败', error)
    }
  })
  return holder.innerHTML
}

function escapeHtml(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** 页面根选择器占位符：导出 HTML 用 `.typora-page`，生成 PDF 时换成离屏容器 */
const PAGE_ROOT = '@page-root@'

const FONT_STACK =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif"
const MONO_STACK = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, 'Courier New', monospace"

/**
 * 正文排版（与阅读页一致）。所有选择器都以 @page-root@ 开头：
 * 导出 HTML 时替换成 `.typora-page`，生成 PDF 时替换成离屏页面容器，
 * 这样同一套排版既能生成独立 HTML，也能用于 html2canvas 截图。
 */
const TYPOGRAPHY_CSS = `
${PAGE_ROOT} {
  color: #2f2f2f;
  font-family: ${FONT_STACK};
  font-size: 16px;
  font-style: normal;
  font-weight: 400;
  line-height: 1.65;
  letter-spacing: 0;
  text-align: left;
  -webkit-font-smoothing: antialiased;
  overflow-wrap: break-word;
}
${PAGE_ROOT} > :first-child { margin-top: 0; }
${PAGE_ROOT} h1,
${PAGE_ROOT} h2,
${PAGE_ROOT} h3,
${PAGE_ROOT} h4,
${PAGE_ROOT} h5,
${PAGE_ROOT} h6 {
  margin: 1.4em 0 0.7em;
  font-family: ${FONT_STACK};
  font-style: normal;
  font-weight: 600;
  line-height: 1.35;
  letter-spacing: 0;
  color: #222222;
}
${PAGE_ROOT} h1 { font-size: 2em; padding-bottom: 0.25em; border-bottom: 1px solid #ddd6c8; }
${PAGE_ROOT} h2 { font-size: 1.5em; padding-bottom: 0.2em; border-bottom: 1px solid #ddd6c8; }
${PAGE_ROOT} h3 { font-size: 1.25em; }
${PAGE_ROOT} h4 { font-size: 1em; }
${PAGE_ROOT} h5 { font-size: 0.875em; }
${PAGE_ROOT} h6 { font-size: 0.85em; color: #777777; }
${PAGE_ROOT} p { margin: 0.8em 0; }
${PAGE_ROOT} strong { font-weight: 600; color: #1f1f1f; }
${PAGE_ROOT} em { font-style: italic; }
${PAGE_ROOT} a { color: #4183c4; text-decoration: none; background-color: transparent; }
${PAGE_ROOT} a:hover { text-decoration: underline; }
${PAGE_ROOT} mark { background-color: #fff3a3; padding: 0 0.15em; }
${PAGE_ROOT} ul,
${PAGE_ROOT} ol { margin: 0.8em 0; padding-left: 2em; }
${PAGE_ROOT} ul { list-style-type: disc; }
${PAGE_ROOT} ul ul { list-style-type: circle; }
${PAGE_ROOT} ul ul ul { list-style-type: square; }
${PAGE_ROOT} ol { list-style-type: decimal; }
${PAGE_ROOT} li { display: list-item; margin: 0.25em 0; }
${PAGE_ROOT} li > p { margin: 0.2em 0; }
${PAGE_ROOT} blockquote {
  margin: 0.8em 0;
  padding: 0 1em;
  color: #777777;
  border-left: 3px solid #ddd6c8;
}
${PAGE_ROOT} blockquote > :first-child { margin-top: 0; }
${PAGE_ROOT} blockquote > :last-child { margin-bottom: 0; }
${PAGE_ROOT} hr { height: 1px; margin: 1.8em 0; border: 0; background-color: #ddd6c8; }
${PAGE_ROOT} img { max-width: 100%; }
${PAGE_ROOT} table { border-collapse: collapse; margin: 0.8em 0; max-width: 100%; }
${PAGE_ROOT} th,
${PAGE_ROOT} td { padding: 6px 13px; border: 1px solid #ddd6c8; }
${PAGE_ROOT} th { font-weight: 600; background-color: #f3eddf; }
${PAGE_ROOT} tbody tr:nth-child(2n) { background-color: #f8f3e8; }
${PAGE_ROOT} code,
${PAGE_ROOT} pre,
${PAGE_ROOT} kbd,
${PAGE_ROOT} samp { font-family: ${MONO_STACK}; }
${PAGE_ROOT} code {
  padding: 0.15em 0.35em;
  border-radius: 3px;
  background-color: #ece5d6;
  font-size: 0.9em;
}
${PAGE_ROOT} pre {
  margin: 0.9em 0;
  padding: 14px 16px;
  overflow: auto;
  border-radius: 4px;
  background-color: #efe9db;
}
${PAGE_ROOT} pre code {
  display: block;
  padding: 0;
  background-color: transparent;
  font-size: 14px;
  line-height: 1.6;
}
${PAGE_ROOT} .task-list-item { list-style: none; }
${PAGE_ROOT} .task-list-item input { margin-right: 0.4em; }
${PAGE_ROOT} .footnotes {
  margin-top: 2em;
  padding-top: 1em;
  border-top: 1px solid #ddd6c8;
  font-size: 0.85em;
}
`

/** 独立 HTML 的页面外壳（纸张卡片、页面居中） */
const EXPORT_SHELL_CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
html { background-color: #f5f0e8; }
body { margin: 0; padding: 40px 16px; background-color: #f5f0e8; }
.typora-page {
  max-width: 860px;
  margin: 0 auto;
  padding: 40px 48px;
  background-color: #faf6ee;
  border: 1px solid #e4dac8;
  border-radius: 5px;
}
`

/** 打印（浏览器另存为 PDF 的兜底场景） */
const PRINT_CSS = `
@page { margin: 16mm 14mm; }
@media print {
  html, body { background-color: #ffffff; }
  body { padding: 0; }
  .typora-page {
    max-width: none;
    padding: 0;
    border: 0;
    border-radius: 0;
    background-color: #ffffff;
  }
  pre, blockquote, table { break-inside: avoid; }
}
`

/** highlight.js 的 GitHub 主题把代码块背景设成白色，导出时改回纸张色 */
const CODE_OVERRIDE_CSS = `
pre code.hljs { background-color: transparent !important; padding: 0 !important; }
`

/** 正文排版 CSS：把根选择器换成调用方给的容器 */
export function pageTypographyCss(rootSelector = '.typora-page') {
  return TYPOGRAPHY_CSS.split(PAGE_ROOT).join(rootSelector)
}

/** 代码高亮主题 + 纸张色覆盖，导出 HTML / 生成 PDF 共用 */
export function codeThemeCss() {
  return `${githubCodeCss}\n${CODE_OVERRIDE_CSS}`
}

/**
 * 生成可直接打开的独立 HTML 文档。
 * @param {{ title?: string, bodyHtml: string }} options
 */
export function buildExportHtml({ title = '', bodyHtml = '' } = {}) {
  const pageTitle = escapeHtml(title || '未命名文档')
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="generator" content="blog-markdown-export" />
<title>${pageTitle}</title>
<style>
${EXPORT_SHELL_CSS}
${pageTypographyCss('.typora-page')}
${codeThemeCss()}
${PRINT_CSS}
</style>
</head>
<body>
<main class="typora-page">
${bodyHtml}
</main>
</body>
</html>
`
}
