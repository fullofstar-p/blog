/**
 * Markdown 运行时静态资源拷贝脚本（Vditor + highlight.js）。
 *
 * Vditor 的 lute（Markdown 解析）、i18n、图标、代码高亮样式等是运行时按需
 * 加载的独立文件，默认走 CDN（unpkg）。为了离线/内网可用，这里把最小资源集
 * 从 node_modules 复制到 public/vditor/dist，并在编辑器里用 `cdn: '/vditor'`。
 *
 * md-editor-v3（阅读态预览）默认也会从 unpkg 拉 highlight.min.js 和 atom-one-dark
 * 主题，离线时完全没有代码高亮；这里把 highlight.js 的 GitHub 浅色主题一起拷到
 * public/highlight，配合 MarkdownViewer.vue 里的本地 highlight.js 实例使用。
 *
 * P3-2 数学公式 / Mermaid / ECharts 同样复用 Vditor 自带运行时资源：
 * katex（含字体）、mermaid、echarts 都拷到 public/vditor/dist/js 下，编辑器与
 * 阅读页都通过 `/vditor/dist/js/...` 本地加载，断网/无 CDN 也能渲染。
 *
 * 由 package.json 的 predev / prebuild 自动触发；public/vditor 与 public/highlight
 * 属于生成物，已在 .gitignore 中忽略。
 */
import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const scriptDir = dirname(fileURLToPath(import.meta.url))
const frontendDir = join(scriptDir, '..')
const sourceDir = join(frontendDir, 'node_modules', 'vditor', 'dist')
const targetDir = join(frontendDir, 'public', 'vditor', 'dist')

// 只拷贝实际用到的资源：lute 解析器、中文语言包、图标、代码高亮、主题样式、表情
const items = [
  'css',
  'images',
  join('js', 'lute'),
  join('js', 'i18n'),
  join('js', 'icons'),
  join('js', 'highlight.js'),
  // 数学公式（含 fonts，KaTeX CSS 用相对路径引字体）按需加载
  join('js', 'katex'),
  // P3-2：Mermaid 图与 ECharts 图表（Vditor 运行时会按 cdn 拼 /dist/js/... 路径）
  join('js', 'mermaid'),
  join('js', 'echarts')
]

if (!existsSync(sourceDir)) {
  console.warn('[vditor] 未找到 node_modules/vditor，跳过静态资源拷贝（先执行 npm install）')
  process.exit(0)
}

for (const item of items) {
  const from = join(sourceDir, item)
  if (!existsSync(from)) {
    console.warn(`[vditor] 跳过不存在的资源：${item}`)
    continue
  }
  const to = join(targetDir, item)
  mkdirSync(dirname(to), { recursive: true })
  cpSync(from, to, { recursive: true })
}

console.log('[vditor] 静态资源已拷贝到 public/vditor/dist')

// ---------- highlight.js：阅读页代码高亮主题 ----------
// 浅色 GitHub 主题与白色阅读页、#f6f8fa 代码块配套；文件很小，直接拷一份到 public。
const hljsStyle = join(frontendDir, 'node_modules', 'highlight.js', 'styles', 'github.css')
const hljsTarget = join(frontendDir, 'public', 'highlight', 'github.css')

if (existsSync(hljsStyle)) {
  mkdirSync(dirname(hljsTarget), { recursive: true })
  cpSync(hljsStyle, hljsTarget)
  console.log('[highlight] 代码高亮主题已拷贝到 public/highlight/github.css')
} else {
  console.warn('[highlight] 未找到 node_modules/highlight.js，跳过高亮主题拷贝（先执行 npm install）')
}
