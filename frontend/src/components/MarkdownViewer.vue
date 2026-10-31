<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { MdPreview, config } from 'md-editor-v3'
import hljs from 'highlight.js/lib/common'
// 本地 GitHub 浅色高亮主题：与阅读页纸张底色 + #f6f8fa 代码块配套，离线可用。
// public/highlight/github.css 由 scripts/copy-vditor.mjs 在 predev / prebuild 时生成；
// md-editor-v3 配置了 highlight.instance 后不会再向 CDN 注入高亮脚本与主题 CSS，
// 所以这里同时把同一份主题交给 Vite 打包，保证阅读页一定有配色。
import 'highlight.js/styles/github.css'
import { useThemeStore } from '@/store/theme'

const props = defineProps({
  content: { type: String, default: '' }
})

const theme = useThemeStore()
// 阅读态跟着站点主题走：theme 变化时 CSS 立刻切换，图表由 scan 重新渲染
const mdTheme = computed(() => (theme.isDark ? 'dark' : 'light'))

// 阅读态代码高亮：用本地 highlight.js 实例 + GitHub 浅色主题。
// 不配置 instance 时 md-editor-v3 会运行时从 unpkg 拉 highlight.min.js 与
// atom-one-dark：离线/内网拉不到就完全没有高亮，CDN 可用时深色配色又与纸张不搭。
// P3-2：KaTeX 也用 Vditor 自带的本地运行时资源（含字体），断网也能渲染。
config({
  editorExtensions: {
    highlight: {
      instance: hljs,
      css: {
        github: {
          light: '/highlight/github.css',
          dark: '/highlight/github.css'
        }
      }
    },
    katex: {
      js: '/vditor/dist/js/katex/katex.min.js',
      css: '/vditor/dist/js/katex/katex.min.css'
    }
  }
})

const uid = `preview-${Math.random().toString(36).slice(2, 9)}`
const root = ref(null)

const MERMAID_SRC = '/vditor/dist/js/mermaid/mermaid.min.js'
const ECHARTS_SRC = '/vditor/dist/js/echarts/echarts.min.js'

// md-editor-v3 内置的 Mermaid 接管（replaceMermaid）实测在无头 Edge 下渲染失败，
// 且没有 ECharts 钩子；这里关闭它的 Mermaid 插件（MdPreview :no-mermaid），
// 在预览 DOM 渲染完后自己接管 ```mermaid / ```echarts 代码块：
// - Mermaid：本地 mermaid.min.js + mermaid.render(id, code)（两个参数），
//   把 SVG 塞进 `.p32-mermaid.md-editor-mermaid` 容器，源码块隐藏；
// - ECharts：本地 echarts.min.js，JSON 配置 -> `.p32-echarts` 图表容器；
// - 失败时保留源码块展示，不吞内容；主题变化时清空重渲染。
// 渲染是幂等的：块上打 data-p32-chart 标记，scan 结束后若还有未处理块会自动补扫。
const charts = new Map()
const scriptLoads = new Map()
let mermaidSeq = 0
let observer = null
let scanTimer = 0
let scanning = false
let scanAgain = false

/** 本地脚本只加载一次；失败缓存 null，避免每次 scan 反复插入 <script> */
function loadScript(src, id, pick) {
  const ready = pick()
  if (ready) return Promise.resolve(ready)
  if (scriptLoads.has(src)) return scriptLoads.get(src)
  const promise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.id = id
    script.src = src
    script.async = true
    script.addEventListener('load', () => {
      const value = pick()
      if (value) resolve(value)
      else reject(new Error(`脚本未挂载全局变量：${src}`))
    })
    script.addEventListener('error', () => reject(new Error(`脚本加载失败：${src}`)))
    document.head.appendChild(script)
  }).catch((error) => {
    console.warn('[markdown] 图表运行时加载失败', error)
    return null
  })
  scriptLoads.set(src, promise)
  return promise
}

const loadMermaid = () => loadScript(MERMAID_SRC, 'p32-mermaid-script', () => window.mermaid)
const loadEcharts = () => loadScript(ECHARTS_SRC, 'p32-echarts-script', () => window.echarts)

function mermaidTheme() {
  return mdTheme.value === 'dark' ? 'dark' : 'default'
}

function initMermaid(mermaid) {
  mermaid.initialize({
    startOnLoad: false,
    // 阅读页展示的是他人文章，用 strict 让 Mermaid 自己转义标签内容，避免 SVG 注入脚本
    securityLevel: 'strict',
    theme: mermaidTheme(),
    fontFamily: 'sans-serif',
    flowchart: { htmlLabels: true, useMaxWidth: true },
    sequence: { useMaxWidth: true }
  })
}

/** 让超宽的 Mermaid 图按自然宽度展示，由外层容器横向滚动，而不是被压扁看不清 */
function fitMermaidSvg(svg) {
  const holder = svg.closest('.p32-mermaid, .md-editor-mermaid') || svg.parentElement
  if (!holder || !svg.viewBox || !svg.viewBox.baseVal || !svg.viewBox.baseVal.width) return
  const natural = svg.viewBox.baseVal.width
  const available = holder.clientWidth - 20
  if (available <= 0) return
  svg.style.maxWidth = 'none'
  svg.style.height = 'auto'
  svg.style.width = natural > available ? `${Math.ceil(natural)}px` : '100%'
}

function disposeCharts() {
  charts.forEach((chart) => {
    try {
      chart.dispose()
    } catch (error) {
      console.warn('[markdown] ECharts 释放失败', error)
    }
  })
  charts.clear()
}

/** 预览 DOM 被 md-editor 重建后，已经脱离文档的图表实例要尽早释放 */
function cleanupDetachedCharts() {
  charts.forEach((chart, container) => {
    if (container.isConnected) return
    try {
      chart.dispose()
    } catch (error) {
      console.warn('[markdown] ECharts 释放失败', error)
    }
    charts.delete(container)
  })
}

function chartLanguage(block) {
  const code = block.querySelector('pre code')
  const className = (code && code.className) || ''
  if (/(^|\s)language-echarts(\s|$)/i.test(className)) return 'echarts'
  if (/(^|\s)language-mermaid(\s|$)/i.test(className)) return 'mermaid'
  return ''
}

function findChartBlocks(previewRoot) {
  return Array.from(previewRoot.querySelectorAll('.md-editor-code')).filter(
    (block) => !block.dataset.p32Chart && Boolean(chartLanguage(block))
  )
}

/** Mermaid：渲染成功后把 SVG 放进图表容器，源码块隐藏 */
async function renderMermaidBlock(block, mermaid) {
  const code = block.querySelector('pre code')
  const source = code ? code.textContent.trim() : ''
  if (!source) {
    block.dataset.p32Chart = 'error'
    return
  }
  const id = `p32-mermaid-${++mermaidSeq}`
  const themeAtRender = mdTheme.value
  try {
    initMermaid(mermaid)
    // 注意：只用两个参数，第三个 container 参数在 md-editor / 无头浏览器组合下会失败
    const result = await mermaid.render(id, source)
    const svg = result && result.svg ? result.svg : ''
    if (!svg) throw new Error('mermaid 未返回 SVG')
    if (!block.isConnected || !root.value || themeAtRender !== mdTheme.value) {
      // 渲染期间 DOM 被重建或主题已切换：交给下一轮 scan 处理
      if (block.isConnected) delete block.dataset.p32Chart
      scheduleScan(150)
      return
    }
    const container = document.createElement('div')
    container.className = 'p32-mermaid md-editor-mermaid'
    container.setAttribute('data-processed', '')
    container.dataset.theme = mdTheme.value
    container.innerHTML = svg
    block.insertAdjacentElement('afterend', container)
    block.classList.add('p32-chart-source')
    block.dataset.p32Chart = '1'
    fitMermaidSvg(container.querySelector('svg'))
  } catch (error) {
    console.warn('[markdown] Mermaid 渲染失败，保留代码块展示', error)
    const leftover = document.getElementById(id)
    if (leftover && leftover.parentElement) leftover.remove()
    block.dataset.p32Chart = 'error'
  }
}

/** ECharts：配置不是合法 JSON 时保留代码块，不吞内容 */
function renderEchartsBlock(block, echarts) {
  const code = block.querySelector('pre code')
  let option = null
  try {
    option = JSON.parse(code ? code.textContent.trim() : '')
  } catch (error) {
    console.warn('[markdown] ECharts 配置不是合法 JSON，保留代码块展示', error)
    block.dataset.p32Chart = 'error'
    return
  }
  if (!option || typeof option !== 'object') {
    block.dataset.p32Chart = 'error'
    return
  }
  const container = document.createElement('div')
  container.className = 'p32-echarts'
  container.setAttribute('role', 'img')
  container.setAttribute('aria-label', 'ECharts 图表')
  block.insertAdjacentElement('afterend', container)
  try {
    const chart = echarts.init(container, mdTheme.value === 'dark' ? 'dark' : undefined, {
      renderer: 'canvas'
    })
    chart.setOption({ backgroundColor: 'transparent', ...option })
    charts.set(container, chart)
    block.classList.add('p32-chart-source')
    block.dataset.p32Chart = '1'
  } catch (error) {
    console.warn('[markdown] ECharts 渲染失败，保留代码块展示', error)
    block.dataset.p32Chart = 'error'
    container.remove()
  }
}

/**
 * 渲染所有图表块。
 * 本地运行时 `await` 回来之后必须重新查询 DOM：等待期间 md-editor 可能因脚本 onload
 * 触发重渲染，复用 await 之前的 block 引用会全部失联（ECharts 实测 bug）。
 */
async function renderCharts() {
  if (!root.value) return
  const previewRoot = root.value.querySelector('.md-editor-preview')
  if (!previewRoot) return
  if (!findChartBlocks(previewRoot).length) return
  const [mermaid, echarts] = await Promise.all([loadMermaid(), loadEcharts()])
  if (!root.value) return
  const freshRoot = root.value.querySelector('.md-editor-preview')
  if (!freshRoot) return
  const blocks = findChartBlocks(freshRoot)
  const jobs = []
  blocks.forEach((block) => {
    const language = chartLanguage(block)
    if (language === 'mermaid') {
      if (!mermaid) {
        block.dataset.p32Chart = 'error'
        return
      }
      block.dataset.p32Chart = 'pending'
      jobs.push(renderMermaidBlock(block, mermaid))
    } else if (language === 'echarts') {
      if (!echarts) {
        block.dataset.p32Chart = 'error'
        return
      }
      block.dataset.p32Chart = 'pending'
      renderEchartsBlock(block, echarts)
    }
  })
  await Promise.all(jobs)
}

function hasPendingCharts() {
  if (!root.value) return false
  const previewRoot = root.value.querySelector('.md-editor-preview')
  if (!previewRoot) return false
  return findChartBlocks(previewRoot).length > 0
}

async function scan() {
  if (scanning || !root.value) return
  scanning = true
  scanAgain = false
  try {
    cleanupDetachedCharts()
    const previewRoot = root.value.querySelector('.md-editor-preview')
    if (!previewRoot) return
    previewRoot
      .querySelectorAll('.p32-mermaid svg, .md-editor-mermaid svg')
      .forEach((svg) => fitMermaidSvg(svg))
    await renderCharts()
  } finally {
    scanning = false
    // 扫描期间 DOM 有变化，或还有没处理完的块：再补一轮（单次补扫，不会死循环）
    if (scanAgain || hasPendingCharts()) scheduleScan(120)
  }
}

function scheduleScan(delay = 120) {
  window.clearTimeout(scanTimer)
  scanTimer = window.setTimeout(() => {
    scanTimer = 0
    scan()
  }, delay)
}

/** 主题切换：清掉旧图表、解除源码块隐藏，让 scan 用新主题重新渲染 */
function resetCharts() {
  disposeCharts()
  const previewRoot = root.value && root.value.querySelector('.md-editor-preview')
  if (!previewRoot) return
  previewRoot.querySelectorAll('.p32-mermaid, .p32-echarts').forEach((element) => element.remove())
  previewRoot.querySelectorAll('.md-editor-code').forEach((block) => {
    if (!block.dataset.p32Chart) return
    delete block.dataset.p32Chart
    block.classList.remove('p32-chart-source')
  })
}

function resizeCharts() {
  charts.forEach((chart) => {
    try {
      chart.resize()
    } catch (error) {
      console.warn('[markdown] ECharts 重排失败', error)
    }
  })
  scheduleScan(80)
}

function onMutations() {
  // 扫描过程中发生 DOM 变化：记 dirty，等当前 scan 结束后补一轮
  if (scanning) {
    scanAgain = true
    return
  }
  scheduleScan()
}

function onWindowResize() {
  resizeCharts()
}

onMounted(() => {
  if (!root.value) return
  observer = new MutationObserver(onMutations)
  observer.observe(root.value, { childList: true, subtree: true })
  window.addEventListener('resize', onWindowResize, { passive: true })
  scheduleScan(0)
})

// 正文变化时 md-editor 会重建预览 DOM，等它渲染完再补图表
watch(
  () => props.content,
  () => {
    nextTick(() => scheduleScan(200))
  }
)

// 主题变化：CSS 立即切换，图表要清掉重渲染（Mermaid 主题 / ECharts 暗色主题）
watch(mdTheme, () => {
  resetCharts()
  nextTick(() => scheduleScan(60))
})

onBeforeUnmount(() => {
  if (observer) observer.disconnect()
  observer = null
  window.removeEventListener('resize', onWindowResize)
  window.clearTimeout(scanTimer)
  disposeCharts()
})
</script>

<template>
  <div ref="root" class="markdown-viewer">
    <MdPreview
      :editor-id="uid"
      :model-value="content || ''"
      :theme="mdTheme"
      preview-theme="default"
      code-theme="github"
      language="zh-CN"
      :show-code-row-number="false"
      :no-mermaid="true"
      :no-iconfont="true"
      class="sketch-markdown"
    />
  </div>
</template>
