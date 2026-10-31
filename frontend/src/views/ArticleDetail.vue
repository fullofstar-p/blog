<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ArticleToc from '@/components/ArticleToc.vue'
import CommentSection from '@/components/CommentSection.vue'
import MarkdownViewer from '@/components/MarkdownViewer.vue'
import ShareCardModal from '@/components/ShareCardModal.vue'
import SketchButton from '@/components/SketchButton.vue'
import SketchEmpty from '@/components/SketchEmpty.vue'
import SketchLoading from '@/components/SketchLoading.vue'
import SketchModal from '@/components/SketchModal.vue'
import TagPill from '@/components/TagPill.vue'
import {
  deleteArticle,
  favoriteArticle,
  getArticle,
  getArticleInteraction,
  getRelatedArticles,
  getShareCardUrl,
  likeArticle,
  unfavoriteArticle,
  unlikeArticle
} from '@/api/article'
import { useAuthStore } from '@/store/auth'
import { formatDate, formatViews, plainText } from '@/utils/format'
import { parseMarkdownHeadings } from '@/utils/markdownToc'
import { pushToast, toastSuccess } from '@/utils/toast'

const props = defineProps({
  id: { type: String, required: true }
})

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

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

// ---------- P1-2 点赞 / 收藏 ----------
const interaction = reactive({
  liked: false,
  favorited: false,
  likeCount: 0,
  favoriteCount: 0
})
const likeBusy = ref(false)
const favoriteBusy = ref(false)

// ---------- P1-4 分享卡片 / P1-5 相关文章 ----------
const shareOpen = ref(false)
const related = ref([])
const relatedLoading = ref(false)
const relatedError = ref('')
const hashCommentId = ref('')

// ---------- OG meta：分享链接预览（组件卸载时恢复原始值）----------
const ogOriginal = new Map()
const OG_PROPERTIES = ['og:title', 'og:description', 'og:image', 'og:url']

function ensureOgMeta(name) {
  const existing = document.head.querySelector(`meta[property="${name}"]`)
  if (existing) return { element: existing, created: false }
  const element = document.createElement('meta')
  element.setAttribute('property', name)
  document.head.appendChild(element)
  return { element, created: true }
}

function applyOgMeta(data) {
  if (!data || data.status !== 1) return
  const origin = window.location.origin
  const cover = data.cover
    ? data.cover.startsWith('http')
      ? data.cover
      : `${origin}${data.cover.startsWith('/') ? '' : '/'}${data.cover}`
    : `${origin}${getShareCardUrl(data.id)}`
  const values = {
    'og:title': data.title || '',
    'og:description': plainText(data.summary || data.content, 120),
    'og:image': cover,
    'og:url': `${origin}/article/${data.id}`
  }
  OG_PROPERTIES.forEach((name) => {
    const { element, created } = ensureOgMeta(name)
    if (!ogOriginal.has(name)) {
      ogOriginal.set(name, {
        created,
        content: created ? null : element.getAttribute('content')
      })
    }
    element.setAttribute('content', values[name])
  })
}

function restoreOgMeta() {
  ogOriginal.forEach((original, name) => {
    const element = document.head.querySelector(`meta[property="${name}"]`)
    if (!element) return
    if (original.created) {
      element.remove()
    } else if (original.content === null) {
      element.removeAttribute('content')
    } else {
      element.setAttribute('content', original.content)
    }
  })
  ogOriginal.clear()
}

function readHashCommentId() {
  const match = /^#comment-(\d+)$/.exec(route.hash || '')
  hashCommentId.value = match ? match[1] : ''
}

function syncInteractionFromArticle(data) {
  interaction.liked = Boolean(data && data.liked)
  interaction.favorited = Boolean(data && data.favorited)
  interaction.likeCount = Number(data && data.likeCount) || 0
  interaction.favoriteCount = Number(data && data.favoriteCount) || 0
}

async function loadInteraction(id) {
  try {
    const data = await getArticleInteraction(id)
    if (!data) return
    interaction.liked = Boolean(data.liked)
    interaction.favorited = Boolean(data.favorited)
    interaction.likeCount = Number(data.likeCount) || 0
    interaction.favoriteCount = Number(data.favoriteCount) || 0
  } catch (err) {
    // 互动状态是增强信息：失败时保留详情接口带回的计数，不打断阅读
    console.warn('[article] 互动状态加载失败', err)
  }
}

async function loadRelated(id) {
  relatedLoading.value = true
  relatedError.value = ''
  try {
    const data = await getRelatedArticles(id, 6)
    related.value = Array.isArray(data) ? data : []
  } catch (err) {
    relatedError.value = (err && err.message) || '相关文章加载失败'
    related.value = []
  } finally {
    relatedLoading.value = false
  }
}

function requireLoginForInteraction() {
  if (auth.isLoggedIn) return true
  pushToast('请先登录后再操作', 'info')
  router.push({ name: 'login', query: { redirect: route.fullPath } })
  return false
}

async function toggleLike() {
  if (!requireLoginForInteraction() || likeBusy.value || !article.value) return
  const previous = { liked: interaction.liked, likeCount: interaction.likeCount }
  const nextLiked = !previous.liked
  // 乐观更新，失败回滚
  interaction.liked = nextLiked
  interaction.likeCount = Math.max(0, previous.likeCount + (nextLiked ? 1 : -1))
  likeBusy.value = true
  try {
    const data = nextLiked
      ? await likeArticle(article.value.id)
      : await unlikeArticle(article.value.id)
    if (data) {
      interaction.liked = Boolean(data.liked)
      interaction.likeCount = Number(data.likeCount) || 0
    }
  } catch (err) {
    interaction.liked = previous.liked
    interaction.likeCount = previous.likeCount
    console.warn('[article] 点赞操作失败', err)
  } finally {
    likeBusy.value = false
  }
}

async function toggleFavorite() {
  if (!requireLoginForInteraction() || favoriteBusy.value || !article.value) return
  const previous = { favorited: interaction.favorited, favoriteCount: interaction.favoriteCount }
  const nextFavorited = !previous.favorited
  interaction.favorited = nextFavorited
  interaction.favoriteCount = Math.max(
    0,
    previous.favoriteCount + (nextFavorited ? 1 : -1)
  )
  favoriteBusy.value = true
  try {
    const data = nextFavorited
      ? await favoriteArticle(article.value.id)
      : await unfavoriteArticle(article.value.id)
    if (data) {
      interaction.favorited = Boolean(data.favorited)
      interaction.favoriteCount = Number(data.favoriteCount) || 0
    }
  } catch (err) {
    interaction.favorited = previous.favorited
    interaction.favoriteCount = previous.favoriteCount
    console.warn('[article] 收藏操作失败', err)
  } finally {
    favoriteBusy.value = false
  }
}

// 阅读进度（0-100）与当前高亮的目录项
const readingProgress = ref(0)
const activeHeading = ref(-1)
const tocOpen = ref(false)
const showBackTop = ref(false)
let scrollFrame = 0
let readingTimer = 0
let backTopTimer = 0
let backTopLocked = false
// 点击目录后，页面平滑滚动期间锁住 activeHeading，避免目录滚动条
// 先跟着中间经过的标题上下来回跳，最后才落到点击项。
let tocJumpIndex = -1
let tocJumpTimer = 0

function finishTocJump() {
  if (tocJumpIndex < 0) return
  tocJumpIndex = -1
  window.clearTimeout(tocJumpTimer)
  scheduleReadingState()
}

function cancelTocJumpOnUserScroll() {
  if (tocJumpIndex < 0) return
  finishTocJump()
}

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
  if (window.scrollY <= 0) backTopLocked = false
  showBackTop.value = !backTopLocked && window.scrollY > 560

  const elements = previewHeadingElements()
  const line = readingOffset()
  if (tocJumpIndex >= 0) {
    const target = elements[tocJumpIndex]
    // 还没滚到目标：保持点击项高亮，目录不再跟着中间标题抖动
    if (target && target.getBoundingClientRect().top > line + 6) {
      activeHeading.value = tocJumpIndex
      return
    }
    tocJumpIndex = -1
    window.clearTimeout(tocJumpTimer)
  }
  let current = -1
  elements.forEach((element, index) => {
    // +6 容差：scrollTo 取整后目标标题可能落在参考线上方 0.5px，
    // 没有容差时点击目录第 N 项会被判成第 N-1 项，目录滚动条看起来「差一格」。
    if (element.getBoundingClientRect().top <= line + 6) current = index
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
  tocJumpIndex = index
  activeHeading.value = index
  window.clearTimeout(tocJumpTimer)
  // scrollend 在支持的浏览器里会提前解锁；这里再留一个兜底
  tocJumpTimer = window.setTimeout(finishTocJump, 2500)
  window.scrollTo({ top: Math.max(0, top), behavior: reduceMotion ? 'instant' : 'smooth' })
}

function scrollToTop() {
  const reduceMotion =
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  backTopLocked = true
  showBackTop.value = false
  window.clearTimeout(backTopTimer)
  // 平滑滚动被用户打断时也要恢复按钮，不能一直锁到页面顶部
  backTopTimer = window.setTimeout(() => {
    backTopLocked = false
    scheduleReadingState()
  }, 1200)
  window.scrollTo({ top: 0, behavior: reduceMotion ? 'instant' : 'smooth' })
}

async function load() {
  loading.value = true
  error.value = ''
  article.value = null
  activeHeading.value = -1
  readingProgress.value = 0
  showBackTop.value = false
  backTopLocked = false
  tocJumpIndex = -1
  window.clearTimeout(tocJumpTimer)
  tocOpen.value = false
  shareOpen.value = false
  related.value = []
  relatedError.value = ''
  relatedLoading.value = false
  likeBusy.value = false
  favoriteBusy.value = false
  syncInteractionFromArticle(null)
  try {
    const data = await getArticle(props.id)
    article.value = data
    syncInteractionFromArticle(data)
    readHashCommentId()
    if (data && data.title) document.title = `${data.title} · 技术分享博客`
    applyOgMeta(data)
    await nextTick()
    scheduleReadingState()
    // MdPreview 渲染 / 封面图加载完成后高度还会变，再校正一次
    window.clearTimeout(readingTimer)
    readingTimer = window.setTimeout(scheduleReadingState, 320)
    if (data && data.status === 1) {
      loadInteraction(data.id)
      loadRelated(data.id)
    }
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
  // Chromium 的 scrollend 用于在平滑滚动真正结束时解锁目录项
  window.addEventListener('scrollend', finishTocJump)
  window.addEventListener('wheel', cancelTocJumpOnUserScroll, { passive: true })
  window.addEventListener('touchstart', cancelTocJumpOnUserScroll, { passive: true })
})

onBeforeUnmount(() => {
  window.removeEventListener('scroll', scheduleReadingState)
  window.removeEventListener('resize', scheduleReadingState)
  window.removeEventListener('scrollend', finishTocJump)
  window.removeEventListener('wheel', cancelTocJumpOnUserScroll)
  window.removeEventListener('touchstart', cancelTocJumpOnUserScroll)
  window.clearTimeout(readingTimer)
  window.clearTimeout(backTopTimer)
  window.clearTimeout(tocJumpTimer)
  if (scrollFrame) window.cancelAnimationFrame(scrollFrame)
  restoreOgMeta()
})

watch(
  () => props.id,
  () => load()
)

watch(
  () => route.hash,
  () => readHashCommentId()
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
        v-show="showBackTop && !tocOpen"
        type="button"
        class="back-to-top"
        aria-label="回到顶部"
        title="回到顶部"
        @click="scrollToTop"
      >
        <span aria-hidden="true">↑</span>
        <span class="back-to-top__text">顶部</span>
      </button>

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
            <span v-if="article.isTop === 1" class="sketch-badge border-sketchred/60 text-sketchred">
              ★ 置顶
            </span>
            <span v-if="article.status === 0" class="sketch-badge border-sketchyellow/60 text-sketchyellow-deep">
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

          <div v-if="article.status === 1" class="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="sketch-btn sketch-btn-sm min-h-[44px] px-3 text-sm"
              :class="interaction.liked ? 'border-sketchred text-sketchred' : ''"
              :aria-pressed="interaction.liked ? 'true' : 'false'"
              :aria-label="
                interaction.liked
                  ? `取消点赞，当前 ${interaction.likeCount} 个赞`
                  : `点赞，当前 ${interaction.likeCount} 个赞`
              "
              :disabled="likeBusy"
              @click="toggleLike"
            >
              <span aria-hidden="true">{{ interaction.liked ? '♥' : '♡' }}</span>
              点赞 {{ interaction.likeCount }}
            </button>

            <button
              type="button"
              class="sketch-btn sketch-btn-sm min-h-[44px] px-3 text-sm"
              :class="interaction.favorited ? 'border-sketchyellow text-sketchyellow-deep' : ''"
              :aria-pressed="interaction.favorited ? 'true' : 'false'"
              :aria-label="
                interaction.favorited
                  ? `取消收藏，当前 ${interaction.favoriteCount} 人收藏`
                  : `收藏，当前 ${interaction.favoriteCount} 人收藏`
              "
              :disabled="favoriteBusy"
              @click="toggleFavorite"
            >
              <span aria-hidden="true">{{ interaction.favorited ? '★' : '☆' }}</span>
              收藏 {{ interaction.favoriteCount }}
            </button>

            <button
              type="button"
              class="sketch-btn sketch-btn-sm min-h-[44px] px-3 text-sm"
              @click="shareOpen = true"
            >
              分享
            </button>
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

        <section
          v-if="article.status === 1 && (relatedLoading || related.length > 0 || relatedError)"
          class="mt-10 border-t-2 border-dashed border-pencil/40 pt-6"
          aria-labelledby="related-heading"
        >
          <div class="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 id="related-heading" class="font-serif text-2xl italic text-pencil">相关文章</h2>
            <button
              v-if="relatedError"
              type="button"
              class="sketch-btn sketch-btn-sm min-h-[44px] px-3 text-sm"
              @click="article && loadRelated(article.id)"
            >
              重新加载
            </button>
          </div>

          <SketchLoading v-if="relatedLoading" :rows="1" label="正在加载相关文章" />

          <div
            v-else-if="relatedError"
            class="border-2 border-dashed border-sketchred/60 bg-paper-soft/70 p-4"
          >
            <p class="font-serif text-sm italic text-sketchred" role="alert">{{ relatedError }}</p>
          </div>

          <div v-else class="grid gap-4 md:grid-cols-3 md:gap-6">
            <RouterLink
              v-for="(item, index) in related"
              :key="item.id"
              :to="{ name: 'article', params: { id: item.id } }"
              class="sketch-card p-4 transition-transform duration-150 hover:rotate-[-0.3deg]"
              :class="index % 2 === 0 ? 'rotate-[-0.2deg]' : 'rotate-[0.2deg]'"
            >
              <h3 class="line-clamp-2 font-serif text-base italic text-pencil">{{ item.title }}</h3>
              <p class="mt-2 font-serif text-xs italic text-ink-300">
                {{ item.categoryName || '未分类' }} · {{ formatDate(item.createTime) }} · ☕
                {{ formatViews(item.viewCount) }}
              </p>
              <div v-if="item.tags && item.tags.length" class="mt-2 flex flex-wrap gap-1">
                <span
                  v-for="tag in item.tags"
                  :key="tag.id"
                  class="sketch-badge px-1.5 py-0.5 text-[10px]"
                >
                  #{{ tag.name }}
                </span>
              </div>
            </RouterLink>
          </div>
        </section>

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

        <CommentSection
          v-if="article.status === 1"
          :article-id="article.id"
          :highlight-comment-id="hashCommentId"
        />
        <p v-else class="mt-10 border-l-2 border-dashed border-sketchyellow pl-3 font-serif text-sm italic text-sketchyellow-deep">
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

      <ShareCardModal v-model="shareOpen" :article="article" />
    </template>
  </div>
</template>
