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

/** 与阅读页 `.typora-page` 一致的纸张排版（导出文件不依赖站点 CSS） */
const PAGE_CSS = `
:root { color-scheme: light; }
* { box-sizing: border-box; }
html { background-color: #f5f0e8; }
body {
  margin: 0;
  padding: 40px 16px;
  background-color: #f5f0e8;
  color: #2f2f2f;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', Arial, sans-serif;
  font-size: 16px;
  line-height: 1.65;
  letter-spacing: 0;
  -webkit-font-smoothing: antialiased;
}
.typora-page {
  max-width: 860px;
  margin: 0 auto;
  padding: 40px 48px;
  background-color: #faf6ee;
  border: 1px solid #e4dac8;
  border-radius: 5px;
}
.typora-page > :first-child { margin-top: 0; }
h1, h2, h3, h4, h5, h6 {
  margin: 1.4em 0 0.7em;
  font-weight: 600;
  line-height: 1.35;
  color: #222222;
}
h1 { font-size: 2em; padding-bottom: 0.25em; border-bottom: 1px solid #ddd6c8; }
h2 { font-size: 1.5em; padding-bottom: 0.2em; border-bottom: 1px solid #ddd6c8; }
h3 { font-size: 1.25em; }
h4 { font-size: 1em; }
h5 { font-size: 0.875em; }
h6 { font-size: 0.85em; color: #777777; }
p { margin: 0.8em 0; }
strong { font-weight: 600; color: #1f1f1f; }
a { color: #4183c4; text-decoration: none; }
a:hover { text-decoration: underline; }
mark { background-color: #fff3a3; padding: 0 0.15em; }
ul, ol { margin: 0.8em 0; padding-left: 2em; }
li { margin: 0.25em 0; }
li > p { margin: 0.2em 0; }
blockquote {
  margin: 0.8em 0;
  padding: 0 1em;
  color: #777777;
  border-left: 3px solid #ddd6c8;
}
blockquote > :first-child { margin-top: 0; }
blockquote > :last-child { margin-bottom: 0; }
hr { height: 1px; margin: 1.8em 0; border: 0; background-color: #ddd6c8; }
img { max-width: 100%; }
table { border-collapse: collapse; margin: 0.8em 0; max-width: 100%; }
th, td { padding: 6px 13px; border: 1px solid #ddd6c8; }
th { font-weight: 600; background-color: #f3eddf; }
tbody tr:nth-child(2n) { background-color: #f8f3e8; }
code {
  padding: 0.15em 0.35em;
  border-radius: 3px;
  background-color: #ece5d6;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, 'Courier New', monospace;
  font-size: 0.9em;
}
pre {
  margin: 0.9em 0;
  padding: 14px 16px;
  overflow: auto;
  border-radius: 4px;
  background-color: #efe9db;
}
pre code {
  display: block;
  padding: 0;
  background-color: transparent;
  font-size: 14px;
  line-height: 1.6;
}
.task-list-item { list-style: none; }
.task-list-item input { margin-right: 0.4em; }
.footnotes { margin-top: 2em; padding-top: 1em; border-top: 1px solid #ddd6c8; font-size: 0.85em; }
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
${PAGE_CSS}
${githubCodeCss}
${CODE_OVERRIDE_CSS}
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

/**
 * 用浏览器打印导出 PDF：把 HTML 写进新窗口并调起打印对话框，用户选「另存为 PDF」。
 * 必须在用户点击的同步调用链里执行，否则会被当成弹窗拦截。
 * @returns {boolean} 是否成功打开打印窗口
 */
export function printHtml(html) {
  const win = window.open('', '_blank')
  if (!win || !win.document) return false
  win.document.open()
  win.document.write(html)
  win.document.close()
  const run = () => {
    try {
      win.focus()
      win.print()
    } catch (error) {
      console.warn('[markdown] 调起打印失败', error)
    }
  }
  // 等图片与内联样式就绪再打印，避免 PDF 缺图
  if (win.document.readyState === 'complete') window.setTimeout(run, 250)
  else win.addEventListener('load', () => window.setTimeout(run, 250))
  return true
}
