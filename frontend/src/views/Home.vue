<script setup>
import { onMounted, ref } from 'vue'
import ArticleCard from '@/components/ArticleCard.vue'
import CategoryBadge from '@/components/CategoryBadge.vue'
import SketchEmpty from '@/components/SketchEmpty.vue'
import SketchLoading from '@/components/SketchLoading.vue'
import SketchPagination from '@/components/SketchPagination.vue'
import TagPill from '@/components/TagPill.vue'
import { getTopArticles, listArticles } from '@/api/article'
import { useMetaStore } from '@/store/meta'

const meta = useMetaStore()

const topArticles = ref([])
const topLoading = ref(false)
const topError = ref('')

const articles = ref([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = 10
const sort = ref('time')
const loading = ref(false)
const error = ref('')

const metaLoading = ref(false)
const metaError = ref('')

async function loadMeta() {
  metaLoading.value = true
  metaError.value = ''
  try {
    await Promise.all([meta.loadCategories(), meta.loadTags()])
  } catch (err) {
    metaError.value = (err && err.message) || '侧栏信息加载失败'
  } finally {
    metaLoading.value = false
  }
}

async function loadTop() {
  topLoading.value = true
  topError.value = ''
  try {
    const data = await getTopArticles(5)
    topArticles.value = Array.isArray(data) ? data : []
  } catch (err) {
    topError.value = (err && err.message) || '置顶文章加载失败'
  } finally {
    topLoading.value = false
  }
}

async function loadArticles() {
  loading.value = true
  error.value = ''
  try {
    const data = await listArticles({ pageNum: pageNum.value, pageSize, sort: sort.value })
    articles.value = (data && data.records) || []
    total.value = (data && data.total) || 0
  } catch (err) {
    error.value = (err && err.message) || '文章列表加载失败'
    articles.value = []
  } finally {
    loading.value = false
  }
}

function changePage(page) {
  if (page === pageNum.value) return
  pageNum.value = page
  loadArticles()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function changeSort(value) {
  if (sort.value === value) return
  sort.value = value
  pageNum.value = 1
  loadArticles()
}

function retryAll() {
  loadMeta()
  loadTop()
  loadArticles()
}

onMounted(() => {
  loadMeta()
  loadTop()
  loadArticles()
})
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
    <!-- Hero -->
    <section class="relative mb-14 md:mb-20">
      <p class="font-serif text-sm italic text-ink-500">一本摊开在桌上的手绘笔记</p>
      <h1 class="mt-2 font-serif text-3xl italic leading-tight text-pencil md:text-5xl">
        把工程实践，画成
        <span class="sketch-wavy text-sketchblue">看得懂</span>
        的笔记
      </h1>
      <p class="mt-4 max-w-2xl font-serif text-base leading-relaxed text-ink-500 md:text-lg">
        这里记录后端、前端、数据库与运维的实践与踩坑。没有完美排版，只有真诚的批注、草稿和被划掉又重写的思考。
      </p>
      <div class="mt-6 flex flex-wrap gap-3">
        <RouterLink
          :to="{ name: 'archive' }"
          class="sketch-btn sketch-btn-primary min-h-[44px] px-5"
        >
          翻阅归档
        </RouterLink>
        <RouterLink
          :to="{ name: 'about' }"
          class="sketch-btn sketch-btn-ghost min-h-[44px] px-5"
        >
          关于本站
        </RouterLink>
      </div>
      <span
        class="pointer-events-none absolute right-0 top-0 hidden rotate-[-4deg] font-serif text-6xl italic text-pencil/15 md:block"
        aria-hidden="true"
        >✎</span
      >
    </section>

    <!-- 置顶文章 -->
    <section v-if="topLoading" class="mb-12">
      <h2 class="mb-4 font-serif text-2xl italic text-pencil md:text-3xl">★ 置顶文章</h2>
      <SketchLoading :rows="1" label="正在加载置顶文章" />
    </section>
    <section v-else-if="topArticles.length" class="mb-12">
      <div class="mb-4 flex items-center justify-between">
        <h2 class="font-serif text-2xl italic text-pencil md:text-3xl">★ 置顶文章</h2>
        <span class="font-serif text-xs italic text-ink-300">共 {{ topArticles.length }} 篇</span>
      </div>
      <div class="grid gap-6 md:grid-cols-2 md:gap-8">
        <ArticleCard
          v-for="(article, index) in topArticles"
          :key="article.id"
          :article="article"
          :class="index % 2 === 0 ? 'rotate-[-0.3deg]' : 'rotate-[0.3deg]'"
        />
      </div>
    </section>
    <p
      v-else-if="topError"
      class="mb-12 border-l-2 border-dashed border-[#b23b2e] pl-3 font-serif text-sm italic text-[#b23b2e]"
    >
      {{ topError }}
    </p>

    <div class="flex flex-col gap-10 md:flex-row md:gap-8">
      <!-- 文章列表 -->
      <div class="min-w-0 flex-1">
        <div
          class="mb-5 flex flex-wrap items-center justify-between gap-3 border-b-2 border-dashed border-pencil/50 pb-3"
        >
          <h2 class="font-serif text-2xl italic text-pencil md:text-3xl">最新文章</h2>
          <div class="flex gap-2" role="group" aria-label="文章排序方式">
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
            <button
              type="button"
              class="inline-flex min-h-[44px] items-center border-2 border-dashed px-3 font-serif text-sm italic transition-colors"
              :class="
                sort === 'views'
                  ? 'border-pencil bg-pencil text-paper'
                  : 'border-pencil/60 text-pencil hover:bg-pencil hover:text-paper'
              "
              :aria-pressed="sort === 'views' ? 'true' : 'false'"
              @click="changeSort('views')"
            >
              按热度
            </button>
          </div>
        </div>

        <SketchLoading v-if="loading" :rows="3" label="正在加载文章列表" />

        <div
          v-else-if="error"
          class="flex flex-col items-start gap-3 border-2 border-dashed border-[#b23b2e]/60 bg-paper-soft/70 p-5"
        >
          <p class="font-serif text-sm italic text-[#b23b2e]" role="alert">{{ error }}</p>
          <button type="button" class="sketch-btn min-h-[44px] px-4" @click="retryAll">
            重新加载
          </button>
        </div>

        <SketchEmpty
          v-else-if="articles.length === 0"
          title="还没有文章"
          description="作者正在纸上打草稿，稍后再来看看吧。"
        />

        <div v-else class="space-y-6 md:space-y-8">
          <ArticleCard
            v-for="(article, index) in articles"
            :key="article.id"
            :article="article"
            :class="index % 2 === 0 ? 'rotate-[-0.2deg]' : 'rotate-[0.2deg]'"
          />
        </div>

        <div v-if="total > pageSize && !loading" class="mt-8">
          <SketchPagination
            :page-num="pageNum"
            :total="total"
            :page-size="pageSize"
            @update:page-num="changePage"
          />
        </div>
      </div>

      <!-- 侧栏 -->
      <aside class="w-full shrink-0 md:w-64">
        <div class="sketch-card rotate-[0.4deg] p-5 md:p-6">
          <div class="flex items-center justify-between">
            <h2 class="font-serif text-lg italic text-pencil">分类</h2>
            <span class="font-serif text-xs italic text-ink-300">◈</span>
          </div>
          <div v-if="metaLoading" class="mt-3 space-y-2">
            <div class="sketch-skeleton h-9 w-full"></div>
            <div class="sketch-skeleton h-9 w-10/12"></div>
            <div class="sketch-skeleton h-9 w-8/12"></div>
          </div>
          <p
            v-else-if="metaError"
            class="mt-3 font-serif text-xs italic text-[#b23b2e]"
          >
            {{ metaError }}
          </p>
          <div v-else-if="meta.categories.length === 0" class="mt-3 font-serif text-sm italic text-ink-300">
            暂无分类
          </div>
          <div v-else class="mt-3 flex flex-wrap gap-2">
            <CategoryBadge
              v-for="category in meta.categories"
              :key="category.id"
              :category="category"
            />
          </div>

          <div class="sketch-hr"></div>

          <div class="flex items-center justify-between">
            <h2 class="font-serif text-lg italic text-pencil">标签</h2>
            <span class="font-serif text-xs italic text-ink-300">#</span>
          </div>
          <div v-if="metaLoading" class="mt-3 flex flex-wrap gap-2">
            <div class="sketch-skeleton h-10 w-16"></div>
            <div class="sketch-skeleton h-10 w-20"></div>
            <div class="sketch-skeleton h-10 w-14"></div>
          </div>
          <div v-else-if="meta.tags.length === 0" class="mt-3 font-serif text-sm italic text-ink-300">
            暂无标签
          </div>
          <div v-else class="mt-3 flex flex-wrap gap-2">
            <TagPill v-for="tag in meta.tags" :key="tag.id" :tag="tag" />
          </div>

          <div class="sketch-hr"></div>

          <RouterLink :to="{ name: 'archive' }" class="sketch-link inline-flex min-h-[44px] items-center font-serif text-sm">
            按年月翻阅归档 →
          </RouterLink>
        </div>
      </aside>
    </div>
  </div>
</template>
