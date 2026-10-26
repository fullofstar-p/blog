<script setup>
import { onMounted, reactive, ref } from 'vue'
import { RouterLink } from 'vue-router'
import SketchButton from '@/components/SketchButton.vue'
import SketchEmpty from '@/components/SketchEmpty.vue'
import SketchLoading from '@/components/SketchLoading.vue'
import SketchModal from '@/components/SketchModal.vue'
import SketchPagination from '@/components/SketchPagination.vue'
import { deleteAdminArticle, listAdminArticles, updateArticleTop } from '@/api/admin'
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
const error = ref('')
const togglingId = ref(null)
const deleteTarget = ref(null)
const deleting = ref(false)

async function loadMeta() {
  try {
    await meta.loadCategories()
  } catch (err) {
    console.error('[admin] 分类加载失败', err)
  }
}

async function load() {
  loading.value = true
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
        <p class="mt-1 font-serif text-sm italic text-ink-500">共 {{ total }} 篇文章</p>
      </div>
      <RouterLink :to="{ name: 'admin-article-new' }" class="sketch-btn sketch-btn-primary min-h-[44px] px-5">
        ✎ 写新文章
      </RouterLink>
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

    <SketchLoading v-if="loading" :rows="3" label="正在加载文章管理数据" />

    <div
      v-else-if="error"
      class="mt-5 flex flex-col items-start gap-3 border-2 border-dashed border-[#b23b2e]/60 bg-paper-soft/70 p-5"
    >
      <p class="font-serif text-sm italic text-[#b23b2e]" role="alert">{{ error }}</p>
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

    <div v-else class="mt-5 overflow-x-auto border-2 border-dashed border-pencil/50 bg-paper-soft/40 p-2">
      <table class="w-full min-w-[720px] border-collapse text-left">
        <caption class="sr-only">文章管理列表</caption>
        <thead>
          <tr class="border-b-2 border-dashed border-pencil/60 font-serif text-sm italic text-ink-700">
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
          >
            <td class="max-w-[18rem] px-3 py-3">
              <RouterLink
                :to="{ name: 'article', params: { id: article.id } }"
                class="font-serif text-base italic text-pencil underline decoration-dashed underline-offset-4 hover:text-ink-900"
              >
                {{ article.title }}
              </RouterLink>
              <span v-if="article.isTop === 1" class="ml-1 text-[#b23b2e]" title="已置顶">★</span>
            </td>
            <td class="px-3 py-3">{{ article.categoryName || '未分类' }}</td>
            <td class="px-3 py-3">{{ article.authorName || '—' }}</td>
            <td class="px-3 py-3">
              <span
                class="sketch-badge"
                :class="
                  article.status === 1
                    ? 'border-[#1f7a4d]/60 text-[#1f7a4d]'
                    : 'border-[#9a6a00]/60 text-[#7a5300]'
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
                  class="inline-flex min-h-[44px] items-center border-2 border-dashed border-[#b23b2e]/70 px-2 font-serif text-xs italic text-[#b23b2e] transition-colors hover:bg-[#b23b2e] hover:text-paper"
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
        确定要删除《{{ deleteTarget ? deleteTarget.title : '' }}》吗？删除为逻辑删除。
      </p>
      <template #footer>
        <SketchButton variant="ghost" @click="deleteTarget = null">取消</SketchButton>
        <SketchButton variant="danger" :loading="deleting" @click="confirmDelete">
          确认删除
        </SketchButton>
      </template>
    </SketchModal>
  </div>
</template>
