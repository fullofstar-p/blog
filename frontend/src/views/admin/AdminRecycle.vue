<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import SketchButton from '@/components/SketchButton.vue'
import SketchEmpty from '@/components/SketchEmpty.vue'
import SketchLoading from '@/components/SketchLoading.vue'
import SketchModal from '@/components/SketchModal.vue'
import SketchPagination from '@/components/SketchPagination.vue'
import {
  batchPurgeAdminArticles,
  batchRestoreAdminArticles,
  listRecycleArticles,
  purgeAdminArticle,
  restoreAdminArticle
} from '@/api/admin'
import { formatDate } from '@/utils/format'
import { toastSuccess } from '@/utils/toast'

const filters = reactive({ keyword: '' })
const articles = ref([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = 10
const loading = ref(false)
const refreshing = ref(false)
const loadedOnce = ref(false)
const error = ref('')
const restoringId = ref(null)
const purgeTarget = ref(null)
const purging = ref(false)
const selectedIds = ref([])
const batchRestoreLoading = ref(false)
const batchPurgeOpen = ref(false)
const batchPurging = ref(false)

async function load() {
  // 首次才显示骨架屏，筛选/重置/翻页时保留列表半透明刷新，避免闪烁
  const showSkeleton = !loadedOnce.value || Boolean(error.value)
  if (showSkeleton) loading.value = true
  else refreshing.value = true
  selectedIds.value = []
  error.value = ''
  try {
    const params = { pageNum: pageNum.value, pageSize }
    if (filters.keyword.trim()) params.keyword = filters.keyword.trim()
    const data = await listRecycleArticles(params)
    articles.value = (data && data.records) || []
    total.value = (data && data.total) || 0
    // 还原/彻底删除后当前页可能已空，自动回到上一页
    if (articles.value.length === 0 && pageNum.value > 1) {
      pageNum.value -= 1
      return load()
    }
  } catch (err) {
    error.value = (err && err.message) || '回收站数据加载失败'
    articles.value = []
  } finally {
    loading.value = false
    refreshing.value = false
    loadedOnce.value = true
  }
}

const selectedSet = computed(() => new Set(selectedIds.value))
const allSelected = computed(
  () => articles.value.length > 0 && articles.value.every((article) => selectedSet.value.has(article.id))
)
const someSelected = computed(() =>
  articles.value.some((article) => selectedSet.value.has(article.id))
)

function isSelected(id) {
  return selectedSet.value.has(id)
}

function toggleSelect(id) {
  const index = selectedIds.value.indexOf(id)
  if (index >= 0) selectedIds.value.splice(index, 1)
  else selectedIds.value.push(id)
}

function toggleSelectAll(checked) {
  selectedIds.value = checked ? articles.value.map((article) => article.id) : []
}

function clearSelection() {
  selectedIds.value = []
}

async function batchRestore() {
  if (selectedIds.value.length === 0) return
  batchRestoreLoading.value = true
  try {
    const count = await batchRestoreAdminArticles([...selectedIds.value])
    toastSuccess(`已恢复 ${count} 篇文章`)
    await load()
  } catch (err) {
    console.error('[admin] 批量恢复失败', err)
  } finally {
    batchRestoreLoading.value = false
  }
}

function askBatchPurge() {
  if (selectedIds.value.length > 0) batchPurgeOpen.value = true
}

async function confirmBatchPurge() {
  if (selectedIds.value.length === 0) return
  batchPurging.value = true
  try {
    const count = await batchPurgeAdminArticles([...selectedIds.value])
    toastSuccess(`已彻底删除 ${count} 篇文章`)
    batchPurgeOpen.value = false
    await load()
  } catch (err) {
    console.error('[admin] 批量彻底删除失败', err)
  } finally {
    batchPurging.value = false
  }
}

function submitFilters() {
  pageNum.value = 1
  load()
}

function resetFilters() {
  filters.keyword = ''
  pageNum.value = 1
  load()
}

function changePage(page) {
  if (page === pageNum.value) return
  pageNum.value = page
  load()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function restore(article) {
  restoringId.value = article.id
  try {
    await restoreAdminArticle(article.id)
    toastSuccess(`《${article.title}》已恢复`)
    await load()
  } catch (err) {
    console.error('[admin] 恢复文章失败', err)
  } finally {
    restoringId.value = null
  }
}

function askPurge(article) {
  purgeTarget.value = article
}

async function confirmPurge() {
  if (!purgeTarget.value) return
  purging.value = true
  try {
    await purgeAdminArticle(purgeTarget.value.id)
    toastSuccess('文章已彻底删除')
    purgeTarget.value = null
    await load()
  } catch (err) {
    console.error('[admin] 彻底删除文章失败', err)
  } finally {
    purging.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="font-serif text-2xl italic text-pencil md:text-3xl">回收站</h2>
        <p class="mt-1 font-serif text-sm italic text-ink-500">
          共 {{ total }} 篇文章；恢复后回到文章列表，彻底删除后不可找回。
          <span v-if="refreshing" class="ml-1 text-ink-300" role="status">· 更新中…</span>
        </p>
      </div>
      <RouterLink :to="{ name: 'admin-articles' }" class="sketch-btn min-h-[44px] px-5">
        ← 返回文章管理
      </RouterLink>
    </div>

    <form
      class="mt-5 flex flex-col gap-3 border-2 border-dashed border-pencil/50 bg-paper-soft/60 p-4 md:flex-row md:items-end"
      @submit.prevent="submitFilters"
    >
      <div class="w-full flex-1">
        <label for="admin-recycle-keyword" class="sketch-label">关键词</label>
        <input
          id="admin-recycle-keyword"
          v-model="filters.keyword"
          type="search"
          class="sketch-input"
          placeholder="按标题 / 摘要搜索"
        />
      </div>
      <div class="flex gap-2">
        <SketchButton type="submit" variant="primary">筛选</SketchButton>
        <SketchButton type="button" variant="ghost" @click="resetFilters">重置</SketchButton>
      </div>
    </form>

    <div
      v-if="selectedIds.length > 0"
      class="mt-4 flex flex-wrap items-center gap-2 border-2 border-dashed border-pencil/50 bg-paper-soft/60 p-3"
      role="region"
      aria-label="回收站批量操作"
    >
      <span class="mr-1 font-serif text-sm italic text-ink-700">
        已选 <strong class="text-pencil">{{ selectedIds.length }}</strong> 篇
      </span>
      <SketchButton type="button" variant="ghost" :loading="batchRestoreLoading" @click="batchRestore">
        ↺ 批量恢复
      </SketchButton>
      <SketchButton type="button" variant="danger" @click="askBatchPurge">批量彻底删除</SketchButton>
      <button
        type="button"
        class="ml-auto min-h-[44px] px-3 font-serif text-xs italic text-ink-300 underline decoration-dashed underline-offset-4 hover:text-pencil"
        @click="clearSelection"
      >
        取消选择
      </button>
    </div>

    <SketchLoading v-if="loading" :rows="3" label="正在加载回收站" />

    <div
      v-else-if="error"
      class="mt-5 flex flex-col items-start gap-3 border-2 border-dashed border-sketchred/60 bg-paper-soft/70 p-5"
    >
      <p class="font-serif text-sm italic text-sketchred" role="alert">{{ error }}</p>
      <button type="button" class="sketch-btn min-h-[44px] px-4" @click="load">重新加载</button>
    </div>

    <SketchEmpty
      v-else-if="articles.length === 0"
      title="回收站是空的"
      description="删除的文章会先放到这里，可以恢复或彻底删除。"
      icon="♻"
    >
      <RouterLink :to="{ name: 'admin-articles' }" class="sketch-btn min-h-[44px] px-4">
        去文章管理
      </RouterLink>
    </SketchEmpty>

    <div
      v-else
      class="mt-5 overflow-x-auto border-2 border-dashed border-pencil/50 bg-paper-soft/40 p-2 transition-opacity duration-150"
      :class="{ 'pointer-events-none opacity-60': refreshing }"
      :aria-busy="refreshing ? 'true' : 'false'"
    >
      <table class="w-full min-w-[800px] border-collapse text-left">
        <caption class="sr-only">回收站列表</caption>
        <thead>
          <tr class="border-b-2 border-dashed border-pencil/60 font-serif text-sm italic text-ink-700">
            <th class="w-10 px-2 py-3">
              <input
                type="checkbox"
                class="sketch-checkbox"
                :checked="allSelected"
                :indeterminate="someSelected && !allSelected"
                aria-label="全选当前页文章"
                @change="toggleSelectAll($event.target.checked)"
              />
            </th>
            <th class="px-3 py-3">标题</th>
            <th class="px-3 py-3">原状态</th>
            <th class="px-3 py-3">分类</th>
            <th class="px-3 py-3">作者</th>
            <th class="px-3 py-3">删除时间</th>
            <th class="px-3 py-3 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="article in articles"
            :key="article.id"
            class="border-b border-dashed border-pencil/30 align-top font-serif text-sm text-ink-700"
            :class="{ 'bg-paper-deep/40': isSelected(article.id) }"
          >
            <td class="px-2 py-3">
              <input
                type="checkbox"
                class="sketch-checkbox"
                :checked="isSelected(article.id)"
                :aria-label="`选择《${article.title}》`"
                @change="toggleSelect(article.id)"
              />
            </td>
            <td class="max-w-[20rem] px-3 py-3">
              <span class="font-serif text-base italic text-pencil line-through decoration-dashed">
                {{ article.title }}
              </span>
              <span v-if="article.isTop === 1" class="ml-1 text-sketchred" title="已置顶">★</span>
            </td>
            <td class="px-3 py-3">
              <span
                class="sketch-badge"
                :class="
                  article.status === 1
                    ? 'border-sketchgreen/60 text-sketchgreen'
                    : 'border-sketchyellow/60 text-sketchyellow-deep'
                "
              >
                {{ article.status === 1 ? '已发布' : '草稿' }}
              </span>
            </td>
            <td class="px-3 py-3">{{ article.categoryName || '未分类' }}</td>
            <td class="px-3 py-3">{{ article.authorName || '—' }}</td>
            <td class="px-3 py-3">{{ formatDate(article.deletedTime) }}</td>
            <td class="px-3 py-3">
              <div class="flex flex-wrap justify-end gap-1">
                <button
                  type="button"
                  class="inline-flex min-h-[44px] items-center border-2 border-dashed border-pencil/60 px-2 font-serif text-xs italic text-pencil transition-colors hover:bg-pencil hover:text-paper disabled:opacity-50"
                  :disabled="restoringId === article.id"
                  @click="restore(article)"
                >
                  {{ restoringId === article.id ? '恢复中…' : '恢复' }}
                </button>
                <button
                  type="button"
                  class="inline-flex min-h-[44px] items-center border-2 border-dashed border-sketchred/70 px-2 font-serif text-xs italic text-sketchred transition-colors hover:bg-sketchred hover:text-paper"
                  @click="askPurge(article)"
                >
                  彻底删除
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <div v-if="total > pageSize && !loading" class="mt-6">
      <SketchPagination
        :page-num="pageNum"
        :total="total"
        :page-size="pageSize"
        @update:page-num="changePage"
      />
    </div>

    <SketchModal
      :model-value="Boolean(purgeTarget)"
      title="彻底删除文章"
      @update:model-value="purgeTarget = null"
    >
      <p class="font-serif text-sm leading-relaxed text-ink-700">
        确定要彻底删除《{{ purgeTarget ? purgeTarget.title : '' }}》吗？
      </p>
      <p class="mt-2 border-l-2 border-dashed border-sketchred pl-3 font-serif text-sm italic text-sketchred">
        此操作会同时删除文章标签关联与评论，且无法恢复。
      </p>
      <template #footer>
        <SketchButton variant="ghost" @click="purgeTarget = null">取消</SketchButton>
        <SketchButton variant="danger" :loading="purging" @click="confirmPurge">
          确认彻底删除
        </SketchButton>
      </template>
    </SketchModal>

    <SketchModal v-model="batchPurgeOpen" title="批量彻底删除">
      <p class="font-serif text-sm leading-relaxed text-ink-700">
        确定要彻底删除选中的
        <strong class="text-pencil">{{ selectedIds.length }}</strong>
        篇文章吗？
      </p>
      <p class="mt-2 border-l-2 border-dashed border-sketchred pl-3 font-serif text-sm italic text-sketchred">
        此操作会同时删除文章标签关联、评论与每日统计，且无法恢复。
      </p>
      <template #footer>
        <SketchButton variant="ghost" @click="batchPurgeOpen = false">取消</SketchButton>
        <SketchButton variant="danger" :loading="batchPurging" @click="confirmBatchPurge">
          确认彻底删除 {{ selectedIds.length }} 篇
        </SketchButton>
      </template>
    </SketchModal>
  </div>
</template>
