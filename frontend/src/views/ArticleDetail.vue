<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import ArticleToc from '@/components/ArticleToc.vue'
import CommentSection from '@/components/CommentSection.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import SketchButton from '@/components/SketchButton.vue'
import SketchEmpty from '@/components/SketchEmpty.vue'
import SketchLoading from '@/components/SketchLoading.vue'
import SketchModal from '@/components/SketchModal.vue'
import TagPill from '@/components/TagPill.vue'
import { deleteArticle, getArticle } from '@/api/article'
import { useAuthStore } from '@/store/auth'
import { formatDate, formatViews } from '@/utils/format'
import { parseMarkdownHeadings } from '@/utils/markdownToc'
import { toastSuccess } from '@/utils/toast'

const props = defineProps({
  id: { type: String, required: true }
})

const auth = useAuthStore()
const router = useRouter()

const article = ref(null)
const loading = ref(false)
const error = ref('')
const deleteOpen = ref(false)
const deleting = ref(false)

const canManage = computed(() =>
  Boolean(article.value && auth.user && (auth.user.id === article.value.authorId || auth.isAdmin))
)
const tags = computed(() => (article.value && Array.isArray(article.value.tags) ? article.value.tags : []))
const headings = computed(() =>
  article.value && article.value.content ? parseMarkdownHeadings(article.value.content) : []
)

// 阅读进度（0-100）与当前高亮的目录项
const readingProgress = ref(0)
const activeHeading = ref(-1)
const tocOpen = ref(false)
let scrollFrame = 0
let readingTimer = 0

/** 预览区里已渲染的标题，顺序与 Markdown 里的标题一一对应 */
function previewHeadingElements() {
  const root = document.querySelector('.typora-page .md-editor-preview')
  if (!root) return []
  return Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6'))
}

/** 滚动定位时让标题不被 sticky 顶部导航挡住 */
function readingOffset() {
  const header = document.querySelector('header')
  return (header ? header.offsetHeight : 0) + 24
}

function updateReadingState() {
  scrollFrame = 0
  const documentElement = document.documentElement
  const maxScroll = documentElement.scrollHeight - window.innerHeight
  readingProgress.value =
    maxScroll > 0 ? Math.min(100, Math.max(0, (window.scrollY / maxScroll) * 100)) : 0

  const elements = previewHeadingElements()
  const line = readingOffset()
  let current = -1
  elements.forEach((element, index) => {
    if (element.getBoundingClientRect().top <= line) current = index
  })
  activeHeading.value = current
}

function scheduleReadingState() {
  if (scrollFrame) return
  scrollFrame = window.requestAnimationFrame(updateReadingState)
}

function scrollToHeading(index) {
  const element = previewHeadingElements()[index]
  tocOpen.value = false
  if (!element) return
  const top = element.getBoundingClientRect().top + window.scrollY - readingOffset()
  const reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'instant' : 'smooth' })
  activeHeading.value = index
}

async function load() {
  loading.value = true
  error.value = ''
  article.value = null
  activeHeading.value = -1
  readingProgress.value = 0
  tocOpen.value = false
  try {
    const data = await getArticle(props.id)
    article.value = data
    if (data && data.title) document.title = `${data.title} · 技术分享博客`
    await nextTick()
    scheduleReadingState()
    // MdPreview 渲染 / 封面图加载完成后高度还会变，再校正一次
    window.clearTimeout(readingTimer)
    readingTimer = window.setTimeout(scheduleReadingState, 320)
  } catch (err) {
    error.value = (err && err.message) || '文章加载失败或不存在'
  } finally {
    loading.value = false
    scheduleReadingState()
  }
}

onMounted(() => {
  load()
  window.addEventListener('scroll', scheduleReadingState, { passive: true })
  window.addEventListener('resize', scheduleReadingState)
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', scheduleReadingState)
  window.removeEventListener('resize', scheduleReadingState)
  window.clearTimeout(readingTimer)
  if (scrollFrame) window.cancelAnimationFrame(scrollFrame)
})

watch(
  () => props.id,
  () => load()
)

async function confirmDelete() {
  if (!article.value) return
  deleting.value = true
  try {
    await deleteArticle(article.value.id)
    toastSuccess('文章已删除')
    router.push({ name: 'home' })
  } catch (err) {
    console.error('[article] 删除失败', err)
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
    <SketchLoading v-if="loading" :rows="3" label="正在加载文章" />

    <SketchEmpty
      v-else-if="error"
      title="这篇文章找不到了"
      description="它可能已被删除，或者链接写错了。"
      icon="?"
    >
      <div class="mt-2 flex flex-wrap justify-center gap-3">
        <button type="button" class="sketch-btn min-h-[44px] px-4" @click="load">重新加载</button>
        <RouterLink :to="{ name: 'home' }" class="sketch-btn min-h-[44px] px-4">回到首页</RouterLink>
      </div>
    </SketchEmpty>

    <template v-else-if="article">
      <div
        class="reading-progress"
        role="progressbar"
        aria-label="阅读进度"
        aria-valuemin="0"
        aria-valuemax="100"
        :aria-valuenow="Math.round(readingProgress)"
      >
        <span class="reading-progress__bar" :style="{ width: `${readingProgress}%` }"></span>
      </div>

      <button
        v-if="headings.length"
        type="button"
        class="reading-toc-toggle sketch-btn sketch-btn-sm lg:hidden"
        :aria-expanded="tocOpen ? 'true' : 'false'"
        aria-controls="reading-toc-mobile"
        @click="tocOpen = !tocOpen"
      >
        目录
      </button>
      <div v-if="headings.length && tocOpen" id="reading-toc-mobile" class="reading-toc-mobile lg:hidden">
        <ArticleToc :headings="headings" :active-index="activeHeading" @select="scrollToHeading" />
      </div>

      <div class="lg:grid lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-10">
        <article class="mx-auto max-w-3xl">
        <nav class="mb-4 flex flex-wrap items-center gap-2 font-serif text-xs italic text-ink-300" aria-label="面包屑">
          <RouterLink :to="{ name: 'home' }" class="sketch-link">首页</RouterLink>
          <span aria-hidden="true">/</span>
          <RouterLink
            v-if="article.categoryId"
            :to="{ name: 'category', params: { id: article.categoryId } }"
            class="sketch-link"
          >
            {{ article.categoryName || '分类' }}
          </RouterLink>
          <span v-else>未分类</span>
          <span aria-hidden="true">/</span>
          <span class="text-ink-500">正文</span>
        </nav>

        <header class="border-b-2 border-dashed border-pencil/50 pb-6">
          <div class="mb-3 flex flex-wrap items-center gap-2">
            <span v-if="article.isTop === 1" class="sketch-badge border-[#b23b2e]/60 text-[#b23b2e]">
              ★ 置顶
            </span>
            <span v-if="article.status === 0" class="sketch-badge border-[#9a6a00]/60 text-[#7a5300]">
              草稿
            </span>
            <span v-if="article.categoryName" class="sketch-badge">{{ article.categoryName }}</span>
          </div>

          <h1 class="font-serif text-3xl italic leading-tight text-pencil md:text-5xl">
            {{ article.title }}
          </h1>

          <div class="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 font-serif text-sm italic text-ink-500">
            <span>✎ {{ article.authorName || '匿名作者' }}</span>
            <span>{{ formatDate(article.createTime) }}</span>
            <span>☕ {{ formatViews(article.viewCount) }} 阅读</span>
            <span v-if="article.updateTime">最后修改 {{ formatDate(article.updateTime) }}</span>
          </div>

          <div v-if="canManage" class="mt-4 flex flex-wrap gap-2">
            <RouterLink
              v-if="auth.isAdmin"
              :to="{ name: 'admin-article-edit', params: { id: article.id } }"
              class="sketch-btn sketch-btn-sm min-h-[44px] px-4 text-sm"
            >
              编辑文章
            </RouterLink>
            <button
              type="button"
              class="sketch-btn sketch-btn-danger sketch-btn-sm min-h-[44px] px-4 text-sm"
              @click="deleteOpen = true"
            >
              删除文章
            </button>
          </div>
        </header>

        <img
          v-if="article.cover"
          :src="article.cover"
          :alt="`${article.title} 的封面图`"
          class="mt-8 w-full rotate-[-0.4deg] border-2 border-dashed border-pencil/60 object-cover shadow-sketch"
        />

        <section class="mt-8" aria-label="文章正文">
          <!-- Typora 式白色页面：正文单独成一张纸，外壳样式在 styles/markdown-reading.css -->
          <div class="typora-page">
            <MarkdownViewer :content="article.content" />
          </div>
        </section>

        <div v-if="tags.length" class="mt-8 flex flex-wrap items-center gap-2 border-t-2 border-dashed border-pencil/40 pt-5">
          <span class="font-serif text-sm italic text-ink-500">标签：</span>
          <TagPill v-for="tag in tags" :key="tag.id" :tag="tag" />
        </div>

        <nav class="mt-10 grid gap-4 border-t-2 border-dashed border-pencil/40 pt-6 md:grid-cols-2" aria-label="上一篇与下一篇">
          <RouterLink
            v-if="article.prev"
            :to="{ name: 'article', params: { id: article.prev.id } }"
            class="sketch-card p-4 transition-transform hover:rotate-[-0.5deg]"
          >
            <p class="font-serif text-xs italic text-ink-300">← 上一篇</p>
            <p class="mt-1 font-serif text-base italic text-pencil">{{ article.prev.title }}</p>
          </RouterLink>
          <div v-else class="hidden md:block"></div>
          <RouterLink
            v-if="article.next"
            :to="{ name: 'article', params: { id: article.next.id } }"
            class="sketch-card p-4 text-right transition-transform hover:rotate-[0.5deg]"
          >
            <p class="font-serif text-xs italic text-ink-300">下一篇 →</p>
            <p class="mt-1 font-serif text-base italic text-pencil">{{ article.next.title }}</p>
          </RouterLink>
        </nav>

        <CommentSection v-if="article.status === 1" :article-id="article.id" />
        <p v-else class="mt-10 border-l-2 border-dashed border-[#9a6a00] pl-3 font-serif text-sm italic text-[#7a5300]">
          这是草稿：发布后才会对读者展示，评论功能也会随之开放。
        </p>
      </article>

        <aside v-if="headings.length" class="hidden lg:block">
          <div class="sticky top-24">
            <ArticleToc :headings="headings" :active-index="activeHeading" @select="scrollToHeading" />
          </div>
        </aside>
      </div>

      <SketchModal v-model="deleteOpen" title="删除文章">
        <p class="font-serif text-sm leading-relaxed text-ink-700">
          确定要删除《{{ article.title }}》吗？删除为逻辑删除，列表中不再可见。
        </p>
        <template #footer>
          <SketchButton variant="ghost" @click="deleteOpen = false">取消</SketchButton>
          <SketchButton variant="danger" :loading="deleting" @click="confirmDelete">
            确认删除
          </SketchButton>
        </template>
      </SketchModal>
    </template>
  </div>
</template>
