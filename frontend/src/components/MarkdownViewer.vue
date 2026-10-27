<script setup>
import { MdPreview, config } from 'md-editor-v3'
import hljs from 'highlight.js/lib/common'
// 本地 GitHub 浅色高亮主题：与白色阅读页 + #f6f8fa 代码块配套，离线可用。
// public/highlight/github.css 由 scripts/copy-vditor.mjs 在 predev / prebuild 时生成；
// md-editor-v3 配置了 highlight.instance 后不会再向 CDN 注入高亮脚本与主题 CSS，
// 所以这里同时把同一份主题交给 Vite 打包，保证阅读页一定有配色。
import 'highlight.js/styles/github.css'

defineProps({
  content: { type: String, default: '' }
})

// 阅读态代码高亮：用本地 highlight.js 实例 + GitHub 浅色主题。
// 不配置 instance 时 md-editor-v3 会运行时从 unpkg 拉 highlight.min.js 与
// atom-one-dark：离线/内网拉不到就完全没有高亮，CDN 可用时深色配色又与白纸不搭。
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
    }
  }
})

const uid = `preview-${Math.random().toString(36).slice(2, 9)}`
</script>

<template>
  <div class="markdown-viewer">
    <MdPreview
      :editor-id="uid"
      :model-value="content || ''"
      theme="light"
      preview-theme="default"
      code-theme="github"
      language="zh-CN"
      :show-code-row-number="false"
      :no-mermaid="true"
      :no-katex="true"
      class="sketch-markdown"
    />
  </div>
</template>
