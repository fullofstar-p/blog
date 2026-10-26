<script setup>
import { onMounted, reactive, ref } from 'vue'
import SketchButton from '@/components/SketchButton.vue'
import SketchEmpty from '@/components/SketchEmpty.vue'
import SketchLoading from '@/components/SketchLoading.vue'
import SketchModal from '@/components/SketchModal.vue'
import SketchPagination from '@/components/SketchPagination.vue'
import { auditComment, deleteAdminComment, listAdminComments } from '@/api/admin'
import { formatDate } from '@/utils/format'
import { toastSuccess } from '@/utils/toast'

const filters = reactive({ status: '0' })
const comments = ref([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = 10
const loading = ref(false)
const error = ref('')
const processingId = ref(null)
const deleteTarget = ref(null)
const deleting = ref(false)

const statusMap = {
  0: { label: '待审核', cls: 'border-[#9a6a00]/60 text-[#7a5300]' },
  1: { label: '已通过', cls: 'border-[#1f7a4d]/60 text-[#1f7a4d]' },
  2: { label: '已拒绝', cls: 'border-[#b23b2e]/60 text-[#b23b2e]' }
}

const filterOptions = [
  { value: '0', label: '待审核' },
  { value: '1', label: '已通过' },
  { value: '2', label: '已拒绝' },
  { value: '', label: '全部' }
]

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = { pageNum: pageNum.value, pageSize }
    if (filters.status !== '') params.status = Number(filters.status)
    const data = await listAdminComments(params)
    comments.value = (data && data.records) || []
    total.value = (data && data.total) || 0
  } catch (err) {
    error.value = (err && err.message) || '评论加载失败'
    comments.value = []
  } finally {
    loading.value = false
  }
}

function changeStatus(value) {
  if (filters.status === value) return
  filters.status = value
  pageNum.value = 1
  load()
}

function changePage(page) {
  if (page === pageNum.value) return
  pageNum.value = page
  load()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function audit(comment, status) {
  processingId.value = comment.id
  try {
    await auditComment(comment.id, status)
    toastSuccess(status === 1 ? '评论已通过' : '评论已拒绝')
    load()
  } catch (err) {
    console.error('[admin] 审核失败', err)
  } finally {
    processingId.value = null
  }
}

function askDelete(comment) {
  deleteTarget.value = comment
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await deleteAdminComment(deleteTarget.value.id)
    toastSuccess('评论已删除')
    deleteTarget.value = null
    load()
  } catch (err) {
    console.error('[admin] 删除评论失败', err)
  } finally {
    deleting.value = false
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="font-serif text-2xl italic text-pencil md:text-3xl">评论审核</h2>
        <p class="mt-1 font-serif text-sm italic text-ink-500">
          共 {{ total }} 条评论；通过后才会出现在文章下方。
        </p>
      </div>
      <div class="flex flex-wrap gap-2" role="group" aria-label="按审核状态筛选">
        <button
          v-for="option in filterOptions"
          :key="option.value"
          type="button"
          class="inline-flex min-h-[44px] items-center border-2 border-dashed px-3 font-serif text-sm italic transition-colors"
          :class="
            filters.status === option.value
              ? 'border-pencil bg-pencil text-paper'
              : 'border-pencil/60 text-pencil hover:bg-pencil hover:text-paper'
          "
          :aria-pressed="filters.status === option.value ? 'true' : 'false'"
          @click="changeStatus(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </div>

    <SketchLoading v-if="loading" :rows="3" label="正在加载评论" />

    <div
      v-else-if="error"
      class="mt-5 flex flex-col items-start gap-3 border-2 border-dashed border-[#b23b2e]/60 bg-paper-soft/70 p-5"
    >
      <p class="font-serif text-sm italic text-[#b23b2e]" role="alert">{{ error }}</p>
      <button type="button" class="sketch-btn min-h-[44px] px-4" @click="load">重新加载</button>
    </div>

    <SketchEmpty
      v-else-if="comments.length === 0"
      title="没有待处理的评论"
      description="切换到其他状态看看，或者稍后再来。"
      icon="✉"
    />

    <div v-else class="mt-5 space-y-4">
      <article
        v-for="comment in comments"
        :key="comment.id"
        class="sketch-card p-5 md:p-6"
        :class="comment.id % 2 === 0 ? 'rotate-[-0.2deg]' : 'rotate-[0.2deg]'"
      >
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-serif text-sm font-semibold italic text-pencil">
              {{ comment.nickname || comment.username || '匿名读者' }}
            </span>
            <span v-if="comment.username" class="sketch-badge">@{{ comment.username }}</span>
            <span class="sketch-badge" :class="(statusMap[comment.status] || statusMap[0]).cls">
              {{ (statusMap[comment.status] || statusMap[0]).label }}
            </span>
          </div>
          <span class="font-serif text-xs italic text-ink-300">
            {{ formatDate(comment.createTime) }} · ♥ {{ comment.likeCount || 0 }}
          </span>
        </div>

        <p class="mt-3 whitespace-pre-line border-l-2 border-dashed border-pencil/40 pl-3 font-serif text-sm leading-relaxed text-ink-700">
          {{ comment.content }}
        </p>

        <p class="mt-2 font-serif text-xs italic text-ink-300">
          文章：{{ comment.articleTitle || '—' }}
          <span v-if="comment.parentId"> · 回复评论 #{{ comment.parentId }}</span>
        </p>

        <div class="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            class="sketch-btn sketch-btn-sm min-h-[44px] px-3 text-sm"
            :disabled="processingId === comment.id || comment.status === 1"
            @click="audit(comment, 1)"
          >
            通过
          </button>
          <button
            type="button"
            class="sketch-btn sketch-btn-sm min-h-[44px] px-3 text-sm"
            :disabled="processingId === comment.id || comment.status === 2"
            @click="audit(comment, 2)"
          >
            拒绝
          </button>
          <button
            type="button"
            class="sketch-btn sketch-btn-danger sketch-btn-sm min-h-[44px] px-3 text-sm"
            @click="askDelete(comment)"
          >
            删除
          </button>
        </div>
      </article>
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
      title="删除评论"
      @update:model-value="deleteTarget = null"
    >
      <p class="font-serif text-sm leading-relaxed text-ink-700">
        确定要彻底删除这条评论吗？删除后不可恢复。
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
