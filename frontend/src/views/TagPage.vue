<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import ArticleCard from '@/components/ArticleCard.vue'
import SketchEmpty from '@/components/SketchEmpty.vue'
import SketchLoading from '@/components/SketchLoading.vue'
import SketchPagination from '@/components/SketchPagination.vue'
import { listArticles } from '@/api/article'
import { useMetaStore } from '@/store/meta'

const props = defineProps({
  id: { type: String, required: true }
})

const meta = useMetaStore()

const articles = ref([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = 10
const loading = ref(false)
const error = ref('')
const metaError = ref('')

const tag = computed(() => meta.tags.find((item) => String(item.id) === String(props.id)))

async function loadMeta() {
  metaError.value = ''
  try {
    await meta.loadTags()
  } catch (err) {
    metaError.value = (err && err.message) || '标签信息加载失败'
  }
}

async function loadArticles() {
  loading.value = true
  error.value = ''
  try {
    const data = await listArticles({
      pageNum: pageNum.value,
      pageSize,
      tagId: props.id,
      sort: 'time'
    })
    articles.value = (data && data.records) || []
    total.value = (data && data.total) || 0
  } catch (err) {
    error.value = (err && err.message) || '标签文章加载失败'
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

function retry() {
  loadMeta()
  loadArticles()
}

onMounted(() => {
  loadMeta()
  loadArticles()
})

watch(
  () => props.id,
  () => {
    pageNum.value = 1
    loadMeta()
    loadArticles()
  }
)
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
    <header class="mb-10 border-b-2 border-dashed border-pencil/50 pb-6">
      <p class="font-serif text-sm italic text-ink-500">
        <RouterLink :to="{ name: 'home' }" class="sketch-link">首页</RouterLink>
        <span aria-hidden="true"> / </span>标签
      </p>
      <h1 class="mt-2 font-serif text-3xl italic text-pencil md:text-5xl">
        <span class="text-sketchblue" aria-hidden="true">#</span>
        {{ tag ? tag.name : '标签' }}
      </h1>
      <p class="mt-3 font-serif text-sm italic text-ink-500">
        {{ tag ? `共 ${tag.articleCount ?? total} 篇相关文章` : '按标签翻阅文章' }}
      </p>
      <p v-if="metaError" class="mt-2 font-serif text-xs italic text-[#b23b2e]">{{ metaError }}</p>
    </header>

    <SketchLoading v-if="loading" :rows="3" label="正在加载标签文章" />

    <div
      v-else-if="error"
      class="flex flex-col items-start gap-3 border-2 border-dashed border-[#b23b2e]/60 bg-paper-soft/70 p-5"
    >
      <p class="font-serif text-sm italic text-[#b23b2e]" role="alert">{{ error }}</p>
      <button type="button" class="sketch-btn min-h-[44px] px-4" @click="retry">重新加载</button>
    </div>

    <SketchEmpty
      v-else-if="articles.length === 0"
      title="这个标签下还没有文章"
      description="换个标签看看，或者回到首页逛逛。"
    >
      <RouterLink :to="{ name: 'home' }" class="sketch-btn min-h-[44px] px-4">回到首页</RouterLink>
    </SketchEmpty>

    <template v-else>
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
</template>
