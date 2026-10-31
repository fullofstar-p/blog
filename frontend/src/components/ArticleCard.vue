<script setup>
import TagPill from './TagPill.vue'
import { formatDate, formatViews } from '@/utils/format'

defineProps({
  article: { type: Object, required: true }
})
</script>

<template>
  <article class="sketch-card sketch-card-hover p-5 md:p-7">
    <RouterLink
      :to="{ name: 'article', params: { id: article.id } }"
      class="group block focus-visible:outline-none"
      :aria-label="`阅读文章：${article.title}`"
    >
      <div class="flex flex-col gap-4 md:flex-row md:gap-6">
        <div v-if="article.cover" class="w-full shrink-0 md:w-44">
          <img
            :src="article.cover"
            :alt="`${article.title} 的封面图`"
            class="h-40 w-full rotate-[-0.4deg] border-2 border-dashed border-pencil/70 object-cover shadow-sketchsm md:h-28"
            loading="lazy"
          />
        </div>

        <div class="min-w-0 flex-1">
          <div class="mb-2 flex flex-wrap items-center gap-2">
            <span
              v-if="article.isTop === 1"
              class="sketch-badge border-sketchred/60 text-sketchred"
            >
              ★ 置顶
            </span>
            <span v-if="article.categoryName" class="sketch-badge">
              {{ article.categoryName }}
            </span>
            <span
              v-if="article.status === 0"
              class="sketch-badge border-sketchyellow/60 text-sketchyellow-deep"
            >
              草稿
            </span>
          </div>

          <h3
            class="sketch-wavy inline font-serif text-xl italic leading-snug text-pencil transition-colors duration-150 group-hover:text-ink-900 md:text-2xl"
          >
            {{ article.title }}
          </h3>

          <p v-if="article.summary" class="mt-3 line-clamp-2 font-serif text-sm leading-relaxed text-ink-500">
            {{ article.summary }}
          </p>

          <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 font-serif text-xs italic text-ink-500">
            <span>✎ {{ article.authorName || '匿名作者' }}</span>
            <span>{{ formatDate(article.createTime) }}</span>
            <span>☕ {{ formatViews(article.viewCount) }} 阅读</span>
            <span>♥ {{ formatViews(article.likeCount) }} 点赞</span>
          </div>

          <div v-if="article.tags && article.tags.length" class="mt-3 flex flex-wrap gap-2">
            <TagPill
              v-for="tag in article.tags"
              :key="tag.id"
              :tag="tag"
              :clickable="false"
              size="sm"
            />
          </div>
        </div>
      </div>
    </RouterLink>
  </article>
</template>
