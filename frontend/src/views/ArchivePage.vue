<script setup>
import { onMounted, ref } from 'vue'
import ArticleCard from '@/components/ArticleCard.vue'
import SketchEmpty from '@/components/SketchEmpty.vue'
import SketchLoading from '@/components/SketchLoading.vue'
import SketchPagination from '@/components/SketchPagination.vue'
import { getArchive, listArticles } from '@/api/article'

const archive = ref([])
const archiveLoading = ref(false)
const archiveError = ref('')

const selected = ref(null)
const articles = ref([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = 10
const listLoading = ref(false)
const listError = ref('')

async function loadArchive() {
  archiveLoading.value = true
  archiveError.value = ''
  try {
    const data = await getArchive()
    archive.value = Array.isArray(data) ? data : []
    if (!selected.value && archive.value.length > 0) {
      const firstYear = archive.value[0]
      const firstMonth = firstYear.months && firstYear.months[0]
      if (firstMonth) {
        selected.value = { year: firstYear.year, month: firstMonth.month, count: firstMonth.count }
        loadArticles()
      }
    }
  } catch (err) {
    archiveError.value = (err && err.message) || '归档加载失败'
  } finally {
    archiveLoading.value = false
  }
}

async function loadArticles() {
  if (!selected.value) return
  listLoading.value = true
  listError.value = ''
  try {
    const data = await listArticles({
      pageNum: pageNum.value,
      pageSize,
      year: selected.value.year,
      month: selected.value.month,
      sort: 'time'
    })
    articles.value = (data && data.records) || []
    total.value = (data && data.total) || 0
  } catch (err) {
    listError.value = (err && err.message) || '归档文章加载失败'
    articles.value = []
  } finally {
    listLoading.value = false
  }
}

function choose(year, month) {
  if (
    selected.value &&
    selected.value.year === year &&
    selected.value.month === month
  ) {
    return
  }
  selected.value = { year, month }
  pageNum.value = 1
  articles.value = []
  total.value = 0
  loadArticles()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function changePage(page) {
  if (page === pageNum.value) return
  pageNum.value = page
  loadArticles()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

onMounted(loadArchive)
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
    <header class="mb-10 border-b-2 border-dashed border-pencil/50 pb-6">
      <p class="font-serif text-sm italic text-ink-500">
        <RouterLink :to="{ name: 'home' }" class="sketch-link">首页</RouterLink>
        <span aria-hidden="true"> / </span>归档
      </p>
      <h1 class="mt-2 font-serif text-3xl italic text-pencil md:text-5xl">按年月翻阅</h1>
      <p class="mt-3 font-serif text-sm italic text-ink-500">
        像翻旧笔记本一样，沿着时间的折痕找回读过的字。
      </p>
    </header>

    <SketchLoading v-if="archiveLoading" :rows="2" label="正在加载归档" />

    <div
      v-else-if="archiveError"
      class="flex flex-col items-start gap-3 border-2 border-dashed border-sketchred/60 bg-paper-soft/70 p-5"
    >
      <p class="font-serif text-sm italic text-sketchred" role="alert">{{ archiveError }}</p>
      <button type="button" class="sketch-btn min-h-[44px] px-4" @click="loadArchive">
        重新加载
      </button>
    </div>

    <SketchEmpty
      v-else-if="archive.length === 0"
      title="还没有可归档的文章"
      description="等第一篇文章发布后，这里会自动长出时间线。"
    />

    <div v-else class="flex flex-col gap-8 md:flex-row md:gap-10">
      <!-- 年份 / 月份 -->
      <aside class="w-full shrink-0 md:w-64">
        <div class="sketch-card rotate-[-0.4deg] p-5">
          <h2 class="font-serif text-lg italic text-pencil">时间线</h2>
          <div class="mt-4 space-y-4">
            <section v-for="yearItem in archive" :key="yearItem.year">
              <h3 class="border-b border-dashed border-pencil/40 pb-1 font-serif text-xl italic text-pencil">
                {{ yearItem.year }}
              </h3>
              <div class="mt-2 flex flex-wrap gap-2">
                <button
                  v-for="monthItem in yearItem.months"
                  :key="`${yearItem.year}-${monthItem.month}`"
                  type="button"
                  class="inline-flex min-h-[44px] items-center gap-1 border-2 border-dashed px-3 font-serif text-sm italic transition-colors duration-150 hover:bg-pencil hover:text-paper active:translate-y-[1px]"
                  :class="
                    selected &&
                    selected.year === yearItem.year &&
                    selected.month === monthItem.month
                      ? 'border-pencil bg-pencil text-paper'
                      : 'border-pencil/60 text-pencil'
                  "
                  :aria-pressed="
                    selected &&
                    selected.year === yearItem.year &&
                    selected.month === monthItem.month
                      ? 'true'
                      : 'false'
                  "
                  @click="choose(yearItem.year, monthItem.month)"
                >
                  {{ monthItem.month }} 月
                  <span class="text-xs opacity-70">{{ monthItem.count }}</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </aside>

      <!-- 选中月份的文章 -->
      <div class="min-w-0 flex-1">
        <div class="mb-5 flex flex-wrap items-center justify-between gap-2 border-b-2 border-dashed border-pencil/50 pb-3">
          <h2 class="font-serif text-2xl italic text-pencil md:text-3xl">
            <template v-if="selected">
              {{ selected.year }} 年 {{ selected.month }} 月
            </template>
            <template v-else>选择一个月份</template>
          </h2>
          <span v-if="selected" class="font-serif text-xs italic text-ink-300">
            共 {{ total }} 篇
          </span>
        </div>

        <SketchLoading v-if="listLoading" :rows="3" label="正在加载归档文章" />

        <div
          v-else-if="listError"
          class="flex flex-col items-start gap-3 border-2 border-dashed border-sketchred/60 bg-paper-soft/70 p-5"
        >
          <p class="font-serif text-sm italic text-sketchred" role="alert">{{ listError }}</p>
          <button type="button" class="sketch-btn min-h-[44px] px-4" @click="loadArticles">
            重新加载
          </button>
        </div>

        <SketchEmpty
          v-else-if="selected && articles.length === 0"
          title="这个月还没有文章"
          description="换个年份或月份试试。"
        />

        <template v-else-if="articles.length > 0">
          <div class="space-y-6 md:space-y-8">
            <ArticleCard
              v-for="(article, index) in articles"
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
    </div>
  </div>
</template>
