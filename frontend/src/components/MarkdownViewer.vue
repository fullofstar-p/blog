<script setup>
import { MdPreview } from 'md-editor-v3'

defineProps({
  content: { type: String, default: '' }
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
      code-theme="atom"
      language="zh-CN"
      :show-code-row-number="false"
      :no-mermaid="true"
      :no-katex="true"
      class="sketch-markdown"
    />
  </div>
</template>
