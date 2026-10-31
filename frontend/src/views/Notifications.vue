<script setup>
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import SketchEmpty from '@/components/SketchEmpty.vue'
import SketchLoading from '@/components/SketchLoading.vue'
import SketchPagination from '@/components/SketchPagination.vue'
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  notificationUnread,
  setUnreadCount
} from '@/api/notification'
import { formatDate, timeAgo } from '@/utils/format'
import { toastSuccess } from '@/utils/toast'

const router = useRouter()

const filters = [
  { value: 'all', label: '全部' },
  { value: 'unread', label: '未读' }
]

const filter = ref('all')
const unreadCount = computed(() => notificationUnread.count)
const items = ref([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = 10
const loading = ref(false)
const error = ref('')
const markingId = ref(null)
const markingAll = ref(false)

const TYPE_META = {
  COMMENT: { icon: '💬', label: '评论', cls: 'border-sketchblue/60 text-sketchblue' },
  REPLY: { icon: '↩', label: '回复', cls: 'border-sketchgreen/60 text-sketchgreen' },
  COMMENT_AUDIT: { icon: '✓', label: '审核', cls: 'border-sketchyellow/60 text-sketchyellow-deep' }
}

function typeOf(item) {
  return TYPE_META[item.type] || { icon: '✉', label: '通知', cls: '' }
}

async function refreshUnread() {
  try {
    const data = await getUnreadCount()
    setUnreadCount(data && data.count)
  } catch (err) {
    console.warn('[notifications] 未读数刷新失败', err)
  }
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = { pageNum: pageNum.value, pageSize }
    if (filter.value === 'unread') params.unreadOnly = true
    const data = await listNotifications(params)
    items.value = (data && data.records) || []
    total.value = (data && data.total) || 0
  } catch (err) {
    error.value = (err && err.message) || '通知加载失败'
    items.value = []
  } finally {
    loading.value = false
  }
}

function changeFilter(value) {
  if (filter.value === value) return
  filter.value = value
  pageNum.value = 1
  load()
}

function changePage(page) {
  if (page === pageNum.value) return
  pageNum.value = page
  load()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function retry() {
  refreshUnread()
  load()
}

/** 手动触发全部已读：进入页面不会自动清空未读 */
async function markAllRead() {
  if (markingAll.value || unreadCount.value === 0) return
  markingAll.value = true
  try {
    await markAllNotificationsRead()
    setUnreadCount(0)
    items.value = items.value.map((item) => ({ ...item, isRead: 1 }))
    if (filter.value === 'unread') {
      pageNum.value = 1
      await load()
    }
    toastSuccess('全部通知已标记为已读')
  } catch (err) {
    console.warn('[notifications] 全部已读失败', err)
  } finally {
    markingAll.value = false
  }
}

/** 点击单条：先标记已读，再跳文章；有 commentId 时带评论锚点 */
async function openItem(item) {
  if (!item.isRead) {
    markingId.value = item.id
    try {
      await markNotificationRead(item.id)
      item.isRead = 1
      setUnreadCount(unreadCount.value - 1)
      if (filter.value === 'unread') {
        items.value = items.value.filter((row) => row.id !== item.id)
        total.value = Math.max(0, total.value - 1)
      }
    } catch (err) {
      console.warn('[notifications] 标记已读失败', err)
    } finally {
      markingId.value = null
    }
  }

  if (item.articleId) {
    router.push({
      name: 'article',
      params: { id: item.articleId },
      hash: item.commentId ? `#comment-${item.commentId}` : undefined
    })
  }
}

onMounted(() => {
  refreshUnread()
  load()
})
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-16 md:px-6 md:py-24">
    <header class="mb-8 border-b-2 border-dashed border-pencil/50 pb-6">
      <p class="font-serif text-sm italic text-ink-500">
        <RouterLink :to="{ name: 'home' }" class="sketch-link">首页</RouterLink>
        <span aria-hidden="true"> / </span>消息通知
      </p>

      <div class="mt-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="font-serif text-3xl italic text-pencil md:text-4xl">消息通知</h1>
          <p class="mt-2 font-serif text-sm italic text-ink-500">
            未读 {{ unreadCount }} 条 · 共 {{ total }} 条
          </p>
        </div>
        <button
          type="button"
          class="sketch-btn sketch-btn-sm min-h-[44px] px-4"
          :disabled="markingAll || unreadCount === 0"
          @click="markAllRead"
        >
          {{ markingAll ? '处理中…' : '全部已读' }}
        </button>
      </div>
    </header>

    <div class="mb-5 flex flex-wrap items-center gap-2" role="group" aria-label="通知筛选">
      <button
        v-for="option in filters"
        :key="option.value"
        type="button"
        class="inline-flex min-h-[44px] items-center gap-1 border-2 border-dashed px-3 font-serif text-sm italic transition-colors"
        :class="
          filter === option.value
            ? 'border-pencil bg-pencil text-paper'
            : 'border-pencil/60 text-pencil hover:bg-pencil hover:text-paper'
        "
        :aria-pressed="filter === option.value ? 'true' : 'false'"
        @click="changeFilter(option.value)"
      >
        {{ option.label }}
        <span v-if="option.value === 'unread' && unreadCount > 0" class="text-xs">
          ({{ unreadCount > 99 ? '99+' : unreadCount }})
        </span>
      </button>
    </div>

    <SketchLoading v-if="loading" :rows="3" label="正在加载通知" />

    <div
      v-else-if="error"
      class="flex flex-col items-start gap-3 border-2 border-dashed border-sketchred/60 bg-paper-soft/70 p-5"
    >
      <p class="font-serif text-sm italic text-sketchred" role="alert">{{ error }}</p>
      <button type="button" class="sketch-btn min-h-[44px] px-4" @click="retry">重新加载</button>
    </div>

    <SketchEmpty
      v-else-if="items.length === 0"
      :title="filter === 'unread' ? '没有未读消息' : '还没有收到通知'"
      :description="
        filter === 'unread'
          ? '所有消息都读完啦，去写点新东西吧。'
          : '评论、回复与审核结果会出现在这里。'
      "
      icon="🔔"
    >
      <RouterLink :to="{ name: 'home' }" class="sketch-btn min-h-[44px] px-4">去逛逛</RouterLink>
    </SketchEmpty>

    <div v-else class="space-y-4">
      <button
        v-for="(item, index) in items"
        :key="item.id"
        type="button"
        class="sketch-card block w-full p-5 text-left transition-transform duration-150 hover:rotate-[-0.2deg] disabled:cursor-wait disabled:opacity-70 md:p-6"
        :class="[
          index % 2 === 0 ? 'rotate-[-0.2deg]' : 'rotate-[0.2deg]',
          item.isRead ? '' : 'border-pencil bg-paper-soft'
        ]"
        :disabled="markingId === item.id"
        @click="openItem(item)"
      >
        <span class="flex flex-wrap items-center justify-between gap-2">
          <span class="flex flex-wrap items-center gap-2">
            <span class="sketch-badge" :class="typeOf(item).cls">
              <span aria-hidden="true">{{ typeOf(item).icon }}</span>
              {{ typeOf(item).label }}
            </span>
            <span
              v-if="!item.isRead"
              class="inline-flex items-center gap-1 font-serif text-xs italic text-sketchred"
            >
              <span class="inline-block h-2.5 w-2.5 rotate-[-6deg] bg-sketchred" aria-hidden="true"></span>
              未读
            </span>
            <span v-else class="font-serif text-xs italic text-ink-300">已读</span>
          </span>
          <time
            class="font-serif text-xs italic text-ink-300"
            :datetime="item.createTime"
            :title="formatDate(item.createTime)"
          >
            {{ timeAgo(item.createTime) }}
          </time>
        </span>

        <span
          class="mt-2 block font-serif text-lg italic"
          :class="item.isRead ? 'text-ink-700' : 'font-semibold text-pencil'"
        >
          {{ item.title }}
        </span>

        <span
          class="mt-1 line-clamp-2 font-serif text-sm leading-relaxed"
          :class="item.isRead ? 'text-ink-500' : 'text-ink-700'"
        >
          {{ item.content }}
        </span>

        <span class="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-serif text-xs italic text-ink-300">
          <span v-if="item.articleTitle">《{{ item.articleTitle }}》</span>
          <span v-if="item.senderName">来自 {{ item.senderName }}</span>
          <span v-if="markingId === item.id" class="text-sketchblue">标记已读中…</span>
        </span>
      </button>
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
</template>
