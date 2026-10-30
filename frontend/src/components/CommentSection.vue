<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import CommentItem from './CommentItem.vue'
import SketchEmpty from './SketchEmpty.vue'
import SketchLoading from './SketchLoading.vue'
import SketchModal from './SketchModal.vue'
import { createComment, deleteComment, listComments } from '@/api/comment'
import { useAuthStore } from '@/store/auth'
import { toastError, toastSuccess } from '@/utils/toast'

const props = defineProps({
  articleId: { type: [String, Number], required: true }
})

const auth = useAuthStore()
const router = useRouter()

const comments = ref([])
const totalComments = computed(() => countComments(comments.value))
const loading = ref(false)
const loadError = ref('')
const content = ref('')
const submitting = ref(false)
const submitted = ref(false)
const deleteTarget = ref(null)
const deleting = ref(false)

async function load() {
  loading.value = true
  loadError.value = ''
  try {
    const data = await listComments(props.articleId)
    comments.value = Array.isArray(data) ? data : []
  } catch (error) {
    loadError.value = (error && error.message) || '评论加载失败'
    comments.value = []
  } finally {
    loading.value = false
  }
}

onMounted(load)
watch(() => props.articleId, load)

function goLogin() {
  router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
}

async function submit() {
  const text = content.value.trim()
  if (!text) {
    toastError('评论内容不能为空')
    return
  }
  if (!auth.isLoggedIn) {
    goLogin()
    return
  }
  submitting.value = true
  try {
    await createComment({ articleId: props.articleId, content: text })
    content.value = ''
    submitted.value = true
    toastSuccess('评论已提交，审核通过后展示')
  } catch (error) {
    console.error('[comment] 发表失败', error)
  } finally {
    submitting.value = false
  }
}

function onReplyPosted() {
  submitted.value = true
  load()
}

function askDelete(commentId) {
  deleteTarget.value = { id: commentId }
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await deleteComment(deleteTarget.value.id)
    toastSuccess('评论已删除')
    deleteTarget.value = null
    load()
  } catch (error) {
    console.error('[comment] 删除失败', error)
  } finally {
    deleting.value = false
  }
}

function onLiked(payload) {
  const target = findComment(comments.value, payload.id)
  if (target) {
    target.likeCount = payload.likeCount
    target.liked = payload.liked
  }
}

function findComment(list, id) {
  for (const item of list) {
    if (item.id === id) return item
    const found = findComment(item.replies || [], id)
    if (found) return found
  }
  return null
}

function countComments(list) {
  return list.reduce((sum, item) => sum + 1 + countComments(item.replies || []), 0)
}
</script>

<template>
  <section class="mt-12" aria-labelledby="comments-heading">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <h2 id="comments-heading" class="font-serif text-2xl italic text-pencil md:text-3xl">
        读者评论
        <span class="ml-1 font-serif text-base italic text-ink-300">({{ totalComments }})</span>
      </h2>
      <span class="sketch-badge">评论需审核后展示</span>
    </div>

    <div class="sketch-hr"></div>

    <!-- 发表评论 -->
    <form
      v-if="auth.isLoggedIn"
      class="sketch-card rotate-[-0.2deg] p-5 md:p-6"
      @submit.prevent="submit"
    >
      <label for="comment-content" class="sketch-label">
        以 {{ auth.displayName }} 的身份写下评论
      </label>
      <textarea
        id="comment-content"
        v-model="content"
        rows="3"
        maxlength="1000"
        class="sketch-input resize-y"
        placeholder="友善发言，聊聊你的想法…"
      ></textarea>
      <div class="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p class="font-serif text-xs italic text-ink-300">{{ content.length }} / 1000</p>
        <button
          type="submit"
          class="sketch-btn sketch-btn-primary min-h-[44px] px-5"
          :disabled="submitting"
        >
          {{ submitting ? '提交中…' : '发表评论' }}
        </button>
      </div>
      <p
        v-if="submitted"
        class="mt-2 border-l-2 border-dashed border-sketchgreen pl-2 font-serif text-sm italic text-sketchgreen"
      >
        评论已提交，管理员审核通过后会出现在下方。
      </p>
    </form>

    <div v-else class="sketch-card flex flex-col items-start gap-3 p-5 md:flex-row md:items-center md:justify-between">
      <p class="font-serif text-sm italic text-ink-500">登录后即可参与评论与点赞。</p>
      <button type="button" class="sketch-btn min-h-[44px] px-5" @click="goLogin">去登录</button>
    </div>

    <!-- 评论列表 -->
    <div class="mt-6">
      <SketchLoading v-if="loading" :rows="2" label="正在加载评论" />

      <div
        v-else-if="loadError"
        class="flex flex-col items-start gap-3 border-2 border-dashed border-sketchred/60 bg-paper-soft/70 p-5"
      >
        <p class="font-serif text-sm italic text-sketchred" role="alert">{{ loadError }}</p>
        <button type="button" class="sketch-btn min-h-[44px] px-4" @click="load">重新加载</button>
      </div>

      <SketchEmpty
        v-else-if="comments.length === 0"
        title="还没有评论"
        description="成为第一个留下想法的人吧。"
        icon="✉"
      />

      <div v-else class="space-y-5">
        <CommentItem
          v-for="comment in comments"
          :key="comment.id"
          :comment="comment"
          :depth="0"
          @replied="onReplyPosted"
          @delete="askDelete"
          @liked="onLiked"
        />
      </div>
    </div>

    <SketchModal
      :model-value="Boolean(deleteTarget)"
      title="删除评论"
      @update:model-value="deleteTarget = null"
    >
      <p class="font-serif text-sm leading-relaxed text-ink-700">
        确定要删除这条评论吗？删除后不可恢复。
      </p>
      <template #footer>
        <button type="button" class="sketch-btn min-h-[44px] px-4" @click="deleteTarget = null">
          取消
        </button>
        <button
          type="button"
          class="sketch-btn sketch-btn-danger min-h-[44px] px-4"
          :disabled="deleting"
          @click="confirmDelete"
        >
          {{ deleting ? '删除中…' : '确认删除' }}
        </button>
      </template>
    </SketchModal>
  </section>
</template>
