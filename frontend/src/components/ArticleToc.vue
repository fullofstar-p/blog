<script setup>
import { nextTick, ref, watch } from 'vue'

/**
 * 阅读页目录：只负责渲染标题列表、高亮当前标题、把点击事件抛给父组件。
 * 桌面端的 sticky 定位和移动端的抽屉由 ArticleDetail 控制。
 */
const props = defineProps({
  headings: { type: Array, default: () => [] },
  activeIndex: { type: Number, default: -1 }
})

defineEmits(['select'])

const list = ref(null)

// 长文章滚动时让目录里的当前项保持可见。
// 注意只调整目录容器自己的 scrollTop，不能用 scrollIntoView：
// 桌面端目录滚出视口后，scrollIntoView 会把整个页面拉回目录位置。
watch(
  () => props.activeIndex,
  async (index) => {
    await nextTick()
    const container = list.value
    if (!container || index < 0) return
    const active = container.querySelector('.reading-toc__item.is-active')
    if (!active) return
    const containerRect = container.getBoundingClientRect()
    const activeRect = active.getBoundingClientRect()
    if (activeRect.top < containerRect.top) {
      container.scrollTop -= containerRect.top - activeRect.top + 4
    } else if (activeRect.bottom > containerRect.bottom) {
      container.scrollTop += activeRect.bottom - containerRect.bottom + 4
    }
  }
)
</script>

<template>
  <nav class="reading-toc" aria-label="文章目录">
    <p class="reading-toc__title">目录</p>
    <ol ref="list" class="reading-toc__list">
      <li v-for="(heading, index) in headings" :key="`${heading.line}-${index}`">
        <button
          type="button"
          class="reading-toc__item"
          :class="{ 'is-active': activeIndex === index }"
          :style="{ paddingLeft: `${8 + (heading.level - 1) * 10}px` }"
          :aria-current="activeIndex === index ? 'location' : undefined"
          @click="$emit('select', index)"
        >
          {{ heading.text || '未命名标题' }}
        </button>
      </li>
    </ol>
  </nav>
</template>
