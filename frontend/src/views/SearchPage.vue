<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ArticleCard from '@/components/ArticleCard.vue'
import SketchEmpty from '@/components/SketchEmpty.vue'
import SketchLoading from '@/components/SketchLoading.vue'
import SketchPagination from '@/components/SketchPagination.vue'
import { searchArticles } from '@/api/search'

const route = useRoute()
const router = useRouter()

const input = ref('')
const sort = ref('relevance')
const pageNum = ref(1)
const pageSize = 10

const results = ref([])
const total = ref(0)
const loading = ref(false)
const error = ref('')

const activeKeyword = computed(() => (typeof route.query.keyword === 'string' ? route.query.keyword : ''))

async function search() {
  if (!activeKeyword.value) {
    results.value = []
    total.value = 0
    return
  }
  loading.value = true
  error.value = ''
  try {
    const data = await searchArticles({
      keyword: activeKeyword.value,
      pageNum: pageNum.value,
      pageSize,
      sort: sort.value
    })
    results.value = (data && data.records) || []
    total.value = (data && data.total) || 0
  } catch (err) {
    error.value = (err && err.message) || '搜索失败，请稍后再试'
    results.value = []
  } finally {
    loading.value = false
  }
}

function submit() {
  const value = input.value.trim()
  if (!value) return
  pageNum.value = 1
  router.push({ name: 'search', query: { keyword: value } })
}

function changeSort(value) {
  if (sort.value === value) return
  sort.value = value
  pageNum.value = 1
  search()
}

function changePage(page) {
  if (page === pageNum.value) return
  pageNum.value = page
  search()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(() => {
  input.value = activeKeyword.value
  search()
})

watch(
  () => route.query.keyword,
  (value) => {
    input.value = typeof value === 'string' ? value : ''
    pageNum.value = 1
    search()
  }
)
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
    <header class="mb-10 border-b-2 border-dashed border-pencil/50 pb-6">
      <p class="font-serif text-sm italic text-ink-500">
        <RouterLink :to="{ name: 'home' }" class="sketch-link">首页</RouterLink>
        <span aria-hidden="true"> / </span>搜索
      </p>
      <h1 class="mt-2 font-serif text-3xl italic text-pencil md:text-5xl">翻找笔记</h1>

      <form class="mt-5 flex flex-col gap-2 sm:flex-row" role="search" @submit.prevent="submit">
        <label for="search-keyword" class="sr-only">搜索关键词</label>
        <input
          id="search-keyword"
          v-model="input"
          type="search"
          class="sketch-input flex-1"
          placeholder="输入标题、摘要、正文或标签关键词…"
        />
        <button type="submit" class="sketch-btn sketch-btn-primary min-h-[44px] px-6">搜索</button>
      </form>

      <p v-if="activeKeyword" class="mt-4 font-serif text-sm italic text-ink-500">
        “<span class="sketch-wavy text-pencil">{{ activeKeyword }}</span
        >” 的搜索结果，共 {{ total }} 条
      </p>
    </header>

    <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div class="flex gap-2" role="group" aria-label="搜索结果排序">
        <button
          type="button"
          class="inline-flex min-h-[44px] items-center border-2 border-dashed px-3 font-serif text-sm italic transition-colors"
          :class="
            sort === 'relevance'
              ? 'border-pencil bg-pencil text-paper'
              : 'border-pencil/60 text-pencil hover:bg-pencil hover:text-paper'
          "
          :aria-pressed="sort === 'relevance' ? 'true' : 'false'"
          @click="changeSort('relevance')"
        >
          按相关度
        </button>
        <button
          type="button"
          class="inline-flex min-h-[44px] items-center border-2 border-dashed px-3 font-serif text-sm italic transition-colors"
          :class="
            sort === 'time'
              ? 'border-pencil bg-pencil text-paper'
              : 'border-pencil/60 text-pencil hover:bg-pencil hover:text-paper'
          "
          :aria-pressed="sort === 'time' ? 'true' : 'false'"
          @click="changeSort('time')"
        >
          按时间
        </button>
      </div>
    </div>

    <SketchEmpty
      v-if="!activeKeyword"
      title="输入关键词开始翻找"
      description="试试「Spring Boot」「Vue3」「Docker」这些词。"
      icon="⌕"
    />

    <SketchLoading v-else-if="loading" :rows="3" label="正在搜索" />

    <div
      v-else-if="error"
      class="flex flex-col items-start gap-3 border-2 border-dashed border-sketchred/60 bg-paper-soft/70 p-5"
    >
      <p class="font-serif text-sm italic text-sketchred" role="alert">{{ error }}</p>
      <button type="button" class="sketch-btn min-h-[44px] px-4" @click="search">重新搜索</button>
    </div>

    <SketchEmpty
      v-else-if="results.length === 0"
      title="没有找到相关笔记"
      description="换个关键词，或者去掉一些限定词再试试。"
      icon="⌕"
    />

    <template v-else>
      <div class="space-y-6 md:space-y-8">
        <ArticleCard
          v-for="(article, index) in results"
          :key="article.id"
          :article="article"
          :class="index % 2 === 0 ? 'rotate-[-0.2deg]' : 'rotate-[0.2deg]'"
        />
      </div>
      <div v-if="total > pageSize" class="mt-8">
        <SketchPagination
          :page-num="pageNum"
          :total="total"
          :page-size="pageSize"
          @update:page-num="changePage"
        />
      </div>
    </template>
  </div>
</template>
