/**
 * Vditor 运行时静态资源拷贝脚本。
 *
 * Vditor 的 lute（Markdown 解析）、i18n、图标、代码高亮样式等是运行时按需
 * 加载的独立文件，默认走 CDN（unpkg）。为了离线/内网可用，这里把最小资源集
 * 从 node_modules 复制到 public/vditor/dist，并在编辑器里用 `cdn: '/vditor'`。
 *
 * 由 package.json 的 predev / prebuild 自动触发；public/vditor 属于生成物，
 * 已在 .gitignore 中忽略。
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
  // 数学公式按需加载；不拷贝 6MB 的 mathjax / 3MB 的 mermaid，用不到就不加载
  join('js', 'katex')
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
