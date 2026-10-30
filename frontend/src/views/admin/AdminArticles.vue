<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import SketchButton from '@/components/SketchButton.vue'
import SketchEmpty from '@/components/SketchEmpty.vue'
import SketchLoading from '@/components/SketchLoading.vue'
import SketchModal from '@/components/SketchModal.vue'
import SketchPagination from '@/components/SketchPagination.vue'
import {
  batchDeleteAdminArticles,
  batchUpdateArticleTop,
  deleteAdminArticle,
  listAdminArticles,
  updateArticleTop
} from '@/api/admin'
import { useMetaStore } from '@/store/meta'
import { formatDate, formatViews } from '@/utils/format'
import { toastSuccess } from '@/utils/toast'

const meta = useMetaStore()

const filters = reactive({ status: '', keyword: '', categoryId: '' })
const articles = ref([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = 10
const loading = ref(false)
const refreshing = ref(false)
const loadedOnce = ref(false)
const error = ref('')
const togglingId = ref(null)
const deleteTarget = ref(null)
const deleting = ref(false)
const selectedIds = ref([])
const batchTopLoading = ref(false)
const batchDeleteOpen = ref(false)
const batchDeleting = ref(false)

async function loadMeta() {
  try {
    await meta.loadCategories()
  } catch (err) {
    console.error('[admin] 分类加载失败', err)
  }
}

async function load() {
  // 首次加载才显示骨架屏；筛选/重置/翻页时保留列表，只做半透明刷新，
  // 避免 v-if 在「表格 → 骨架屏 → 表格」之间切换造成闪烁。
  const showSkeleton = !loadedOnce.value || Boolean(error.value)
  if (showSkeleton) loading.value = true
  else refreshing.value = true
  selectedIds.value = []
  error.value = ''
  try {
    const params = { pageNum: pageNum.value, pageSize }
    if (filters.status !== '') params.status = Number(filters.status)
    if (filters.keyword.trim()) params.keyword = filters.keyword.trim()
    if (filters.categoryId !== '') params.categoryId = Number(filters.categoryId)
    const data = await listAdminArticles(params)
    articles.value = (data && data.records) || []
    total.value = (data && data.total) || 0
  } catch (err) {
    error.value = (err && err.message) || '文章管理数据加载失败'
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

async function batchTop(isTop) {
  if (selectedIds.value.length === 0) return
  batchTopLoading.value = true
  try {
    const count = await batchUpdateArticleTop([...selectedIds.value], isTop)
    toastSuccess(`已${isTop === 1 ? '置顶' : '取消置顶'} ${count} 篇文章`)
    await load()
  } catch (err) {
    console.error('[admin] 批量置顶失败', err)
  } finally {
    batchTopLoading.value = false
  }
}

function askBatchDelete() {
  if (selectedIds.value.length > 0) batchDeleteOpen.value = true
}

async function confirmBatchDelete() {
  if (selectedIds.value.length === 0) return
  batchDeleting.value = true
  try {
    const count = await batchDeleteAdminArticles([...selectedIds.value])
    toastSuccess(`已删除 ${count} 篇文章，可在回收站恢复`)
    batchDeleteOpen.value = false
    await load()
  } catch (err) {
    console.error('[admin] 批量删除失败', err)
  } finally {
    batchDeleting.value = false
  }
}

function submitFilters() {
  pageNum.value = 1
  load()
}

function resetFilters() {
  filters.status = ''
  filters.keyword = ''
  filters.categoryId = ''
  pageNum.value = 1
  load()
}

function changePage(page) {
  if (page === pageNum.value) return
  pageNum.value = page
  load()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function toggleTop(article) {
  togglingId.value = article.id
  try {
    const next = article.isTop === 1 ? 0 : 1
    await updateArticleTop(article.id, next)
    toastSuccess(next === 1 ? '已置顶' : '已取消置顶')
    load()
  } catch (err) {
    console.error('[admin] 置顶操作失败', err)
  } finally {
    togglingId.value = null
  }
}

function askDelete(article) {
  deleteTarget.value = article
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await deleteAdminArticle(deleteTarget.value.id)
    toastSuccess('文章已删除')
    deleteTarget.value = null
    load()
  } catch (err) {
    console.error('[admin] 删除文章失败', err)
  } finally {
    deleting.value = false
  }
}

onMounted(() => {
  loadMeta()
  load()
})
</script>

<template>
  <div>
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="font-serif text-2xl italic text-pencil md:text-3xl">文章管理</h2>
        <p class="mt-1 font-serif text-sm italic text-ink-500">
          共 {{ total }} 篇文章
          <span v-if="refreshing" class="ml-1 text-ink-300" role="status">· 更新中…</span>
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <RouterLink :to="{ name: 'admin-recycle' }" class="sketch-btn min-h-[44px] px-5">
          ♻ 回收站
        </RouterLink>
        <RouterLink :to="{ name: 'admin-article-new' }" class="sketch-btn sketch-btn-primary min-h-[44px] px-5">
          ✎ 写新文章
        </RouterLink>
      </div>
    </div>

    <form
      class="mt-5 flex flex-col gap-3 border-2 border-dashed border-pencil/50 bg-paper-soft/60 p-4 md:flex-row md:items-end"
      @submit.prevent="submitFilters"
    >
      <div class="w-full md:w-40">
        <label for="admin-article-status" class="sketch-label">状态</label>
        <select id="admin-article-status" v-model="filters.status" class="sketch-input">
          <option value="">全部</option>
          <option value="1">已发布</option>
          <option value="0">草稿</option>
        </select>
      </div>
      <div class="w-full md:w-48">
        <label for="admin-article-category" class="sketch-label">分类</label>
        <select id="admin-article-category" v-model="filters.categoryId" class="sketch-input">
          <option value="">全部</option>
          <option v-for="category in meta.categories" :key="category.id" :value="String(category.id)">
            {{ category.name }}
          </option>
        </select>
      </div>
      <div class="w-full flex-1">
        <label for="admin-article-keyword" class="sketch-label">关键词</label>
        <input
          id="admin-article-keyword"
          v-model="filters.keyword"
          type="search"
          class="sketch-input"
          placeholder="按标题搜索"
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
      aria-label="批量操作"
    >
      <span class="mr-1 font-serif text-sm italic text-ink-700">
        已选 <strong class="text-pencil">{{ selectedIds.length }}</strong> 篇
      </span>
      <SketchButton type="button" variant="ghost" :loading="batchTopLoading" @click="batchTop(1)">
        ★ 批量置顶
      </SketchButton>
      <SketchButton type="button" variant="ghost" :loading="batchTopLoading" @click="batchTop(0)">
        取消置顶
      </SketchButton>
      <SketchButton type="button" variant="danger" @click="askBatchDelete">批量删除</SketchButton>
      <button
        type="button"
        class="ml-auto min-h-[44px] px-3 font-serif text-xs italic text-ink-300 underline decoration-dashed underline-offset-4 hover:text-pencil"
        @click="clearSelection"
      >
        取消选择
      </button>
    </div>

    <SketchLoading v-if="loading" :rows="3" label="正在加载文章管理数据" />

    <div
      v-else-if="error"
      class="mt-5 flex flex-col items-start gap-3 border-2 border-dashed border-sketchred/60 bg-paper-soft/70 p-5"
    >
      <p class="font-serif text-sm italic text-sketchred" role="alert">{{ error }}</p>
      <button type="button" class="sketch-btn min-h-[44px] px-4" @click="load">重新加载</button>
    </div>

    <SketchEmpty
      v-else-if="articles.length === 0"
      title="没有匹配的文章"
      description="换个筛选条件，或者写一篇新的。"
      icon="✎"
    >
      <RouterLink :to="{ name: 'admin-article-new' }" class="sketch-btn min-h-[44px] px-4">
        写新文章
      </RouterLink>
    </SketchEmpty>

    <div
      v-else
      class="mt-5 overflow-x-auto border-2 border-dashed border-pencil/50 bg-paper-soft/40 p-2 transition-opacity duration-150"
      :class="{ 'pointer-events-none opacity-60': refreshing }"
      :aria-busy="refreshing ? 'true' : 'false'"
    >
      <table class="w-full min-w-[800px] border-collapse text-left">
        <caption class="sr-only">文章管理列表</caption>
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
            <th class="px-3 py-3">分类</th>
            <th class="px-3 py-3">作者</th>
            <th class="px-3 py-3">状态</th>
            <th class="px-3 py-3">阅读</th>
            <th class="px-3 py-3">创建时间</th>
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
            <td class="max-w-[18rem] px-3 py-3">
              <RouterLink
                :to="{ name: 'article', params: { id: article.id } }"
                class="font-serif text-base italic text-pencil underline decoration-dashed underline-offset-4 hover:text-ink-900"
              >
                {{ article.title }}
              </RouterLink>
              <span v-if="article.isTop === 1" class="ml-1 text-sketchred" title="已置顶">★</span>
            </td>
            <td class="px-3 py-3">{{ article.categoryName || '未分类' }}</td>
            <td class="px-3 py-3">{{ article.authorName || '—' }}</td>
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
            <td class="px-3 py-3">{{ formatViews(article.viewCount) }}</td>
            <td class="px-3 py-3">{{ formatDate(article.createTime) }}</td>
            <td class="px-3 py-3">
              <div class="flex flex-wrap justify-end gap-1">
                <button
                  type="button"
                  class="inline-flex min-h-[44px] items-center border-2 border-dashed border-pencil/60 px-2 font-serif text-xs italic text-pencil transition-colors hover:bg-pencil hover:text-paper disabled:opacity-50"
                  :disabled="togglingId === article.id"
                  @click="toggleTop(article)"
                >
                  {{ article.isTop === 1 ? '取消置顶' : '置顶' }}
                </button>
                <RouterLink
                  :to="{ name: 'admin-article-edit', params: { id: article.id } }"
                  class="inline-flex min-h-[44px] items-center border-2 border-dashed border-pencil/60 px-2 font-serif text-xs italic text-pencil transition-colors hover:bg-pencil hover:text-paper"
                >
                  编辑
                </RouterLink>
                <button
                  type="button"
                  class="inline-flex min-h-[44px] items-center border-2 border-dashed border-sketchred/70 px-2 font-serif text-xs italic text-sketchred transition-colors hover:bg-sketchred hover:text-paper"
                  @click="askDelete(article)"
                >
                  删除
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
      :model-value="Boolean(deleteTarget)"
      title="删除文章"
      @update:model-value="deleteTarget = null"
    >
      <p class="font-serif text-sm leading-relaxed text-ink-700">
        确定要删除《{{ deleteTarget ? deleteTarget.title : '' }}》吗？删除后文章会进入回收站，可以恢复。
      </p>
      <template #footer>
        <SketchButton variant="ghost" @click="deleteTarget = null">取消</SketchButton>
        <SketchButton variant="danger" :loading="deleting" @click="confirmDelete">
          确认删除
        </SketchButton>
      </template>
    </SketchModal>

    <SketchModal v-model="batchDeleteOpen" title="批量删除文章">
      <p class="font-serif text-sm leading-relaxed text-ink-700">
        确定要删除选中的
        <strong class="text-pencil">{{ selectedIds.length }}</strong>
        篇文章吗？删除后进入回收站，可以恢复。
      </p>
      <p class="mt-2 border-l-2 border-dashed border-sketchyellow/70 pl-3 font-serif text-sm italic text-ink-500">
        已发布文章会立即从网站前台消失，可在「回收站」批量恢复。
      </p>
      <template #footer>
        <SketchButton variant="ghost" @click="batchDeleteOpen = false">取消</SketchButton>
        <SketchButton variant="danger" :loading="batchDeleting" @click="confirmBatchDelete">
          确认删除 {{ selectedIds.length }} 篇
        </SketchButton>
      </template>
    </SketchModal>
  </div>
</template>
