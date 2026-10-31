<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { createComment, likeComment, unlikeComment } from '@/api/comment'
import { useAuthStore } from '@/store/auth'
import { timeAgo } from '@/utils/format'
import { pushToast, toastError, toastSuccess } from '@/utils/toast'

const props = defineProps({
  comment: { type: Object, required: true },
  depth: { type: Number, default: 0 },
  // 通知跳转高亮：任意层级的目标评论都能被识别
  highlightCommentId: { type: [String, Number], default: null }
})

const emit = defineEmits(['replied', 'delete', 'liked'])

const auth = useAuthStore()
const router = useRouter()

const replyOpen = ref(false)
const replyText = ref('')
const submitting = ref(false)
const liking = ref(false)
const likeCount = ref(Number(props.comment.likeCount) || 0)
const liked = ref(Boolean(props.comment.liked))

// 父组件重新拉取评论后同步服务端返回的已赞状态与点赞数
watch(
  () => props.comment.liked,
  (value) => {
    liked.value = Boolean(value)
  }
)
watch(
  () => props.comment.likeCount,
  (value) => {
    likeCount.value = Number(value) || 0
  }
)

const replies = computed(() => (Array.isArray(props.comment.replies) ? props.comment.replies : []))
const isReply = computed(() => props.depth > 0)
// 后端最多 5 层（depth 0-4），到第 5 层后不再允许继续回复
const canReply = computed(() => props.depth < 4)
const isHighlighted = computed(
  () =>
    props.highlightCommentId !== null &&
    props.highlightCommentId !== undefined &&
    String(props.comment.id) === String(props.highlightCommentId)
)
const canDelete = computed(() =>
  Boolean(auth.user && (auth.user.id === props.comment.userId || auth.isAdmin))
)
const initial = computed(() => {
  const name = props.comment.nickname || '读'
  return String(name).slice(0, 1)
})

function requireLogin() {
  if (auth.isLoggedIn) return true
  pushToast('请先登录后再操作', 'info')
  router.push({ name: 'login', query: { redirect: router.currentRoute.value.fullPath } })
  return false
}

function toggleReply() {
  if (!requireLogin()) return
  replyOpen.value = !replyOpen.value
}

async function submitReply() {
  const content = replyText.value.trim()
  if (!content) {
    toastError('回复内容不能为空')
    return
  }
  if (!requireLogin()) return

  submitting.value = true
  try {
    // 楼中楼：parentId 直接指向被回复的那条评论（后端负责 rootId / depth / 通知）
    await createComment({ articleId: props.comment.articleId, parentId: props.comment.id, content })
    toastSuccess('回复已提交，审核通过后展示')
    replyText.value = ''
    replyOpen.value = false
    emit('replied')
  } catch (error) {
    console.error('[comment] 回复失败', error)
  } finally {
    submitting.value = false
  }
}

async function onLike() {
  if (!requireLogin() || liking.value) return
  liking.value = true
  const nextLiked = !liked.value
  try {
    // 已赞再点 = 取消点赞（DELETE），否则点赞（POST）
    const data = nextLiked ? await likeComment(props.comment.id) : await unlikeComment(props.comment.id)
    liked.value = data && typeof data.liked === 'boolean' ? data.liked : nextLiked
    likeCount.value =
      data && typeof data.likeCount === 'number'
        ? data.likeCount
        : Math.max(0, likeCount.value + (nextLiked ? 1 : -1))
    emit('liked', { id: props.comment.id, likeCount: likeCount.value, liked: liked.value })
  } catch (error) {
    console.error('[comment] 点赞操作失败', error)
  } finally {
    liking.value = false
  }
}
</script>

<template>
  <article
    :id="`comment-${comment.id}`"
    class="border-l-2 border-dashed pl-3 sm:pl-4"
    :class="[
      isReply ? 'ml-2 sm:ml-6' : '',
      isHighlighted ? 'border-sketchyellow bg-sketchyellow/10' : 'border-pencil/40'
    ]"
  >
    <div class="flex gap-3">
      <div class="shrink-0">
        <img
          v-if="comment.avatar"
          :src="comment.avatar"
          alt=""
          class="h-9 w-9 rotate-[-2deg] border-2 border-dashed border-pencil/50 object-cover"
        />
        <span
          v-else
          class="inline-flex h-9 w-9 rotate-[-2deg] items-center justify-center border-2 border-dashed border-pencil/50 font-serif text-sm italic text-ink-500"
          aria-hidden="true"
        >
          {{ initial }}
        </span>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span class="font-serif text-sm font-semibold italic text-pencil">
            {{ comment.nickname || '匿名读者' }}
          </span>
          <span class="font-serif text-xs italic text-ink-300">
            {{ timeAgo(comment.createTime) }}
          </span>
        </div>

        <p v-if="comment.replyToNickname" class="mt-1 font-serif text-xs italic text-ink-300">
          回复
          <span class="text-sketchblue">@{{ comment.replyToNickname }}</span>
        </p>

        <p class="mt-1 whitespace-pre-line font-serif text-sm leading-relaxed text-ink-700">
          {{ comment.content }}
        </p>

        <div class="mt-1 flex flex-wrap items-center gap-1">
          <button
            type="button"
            class="inline-flex min-h-[44px] items-center gap-1 border-2 border-dashed px-2 font-serif text-xs italic transition-colors"
            :class="
              liked
                ? 'border-sketchred/60 text-sketchred'
                : 'border-transparent text-ink-500 hover:border-pencil/50 hover:bg-pencil hover:text-paper'
            "
            :aria-label="liked ? `取消点赞，当前 ${likeCount} 个赞` : `点赞，当前 ${likeCount} 个赞`"
            :aria-pressed="liked ? 'true' : 'false'"
            :disabled="liking"
            @click="onLike"
          >
            <span aria-hidden="true">{{ liked ? '♥' : '♡' }}</span>
            {{ likeCount }}
          </button>

          <button
            type="button"
            class="inline-flex min-h-[44px] items-center border-2 border-dashed border-transparent px-2 font-serif text-xs italic text-ink-500 transition-colors"
            :class="
              canReply
                ? 'hover:border-pencil/50 hover:bg-pencil hover:text-paper'
                : 'cursor-not-allowed opacity-50'
            "
            :disabled="!canReply"
            :title="canReply ? '回复这条评论' : '最多支持 5 层回复'"
            :aria-label="canReply ? `回复 ${comment.nickname || '这条评论'}` : '已达最大回复层级'"
            @click="toggleReply"
          >
            回复
          </button>

          <button
            v-if="canDelete"
            type="button"
            class="inline-flex min-h-[44px] items-center border-2 border-dashed border-transparent px-2 font-serif text-xs italic text-sketchred transition-colors hover:border-sketchred hover:bg-sketchred hover:text-paper"
            @click="emit('delete', comment.id)"
          >
            删除
          </button>
        </div>

        <form
          v-if="replyOpen"
          class="mt-2 flex flex-col gap-2 border-2 border-dashed border-pencil/40 bg-paper-soft/60 p-3"
          @submit.prevent="submitReply"
        >
          <label :for="`reply-${comment.id}`" class="sketch-label">回复 {{ comment.nickname }}</label>
          <textarea
            :id="`reply-${comment.id}`"
            v-model="replyText"
            rows="2"
            maxlength="1000"
            class="sketch-input resize-y text-sm"
            placeholder="写下你的回复…"
          ></textarea>
          <div class="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              class="sketch-btn sketch-btn-sm min-h-[44px] px-3 text-sm"
              @click="replyOpen = false"
            >
              取消
            </button>
            <button
              type="submit"
              class="sketch-btn sketch-btn-primary sketch-btn-sm min-h-[44px] px-3 text-sm"
              :disabled="submitting"
            >
              {{ submitting ? '提交中…' : '提交回复' }}
            </button>
          </div>
        </form>

        <div v-if="replies.length" class="mt-3 space-y-3">
          <CommentItem
            v-for="reply in replies"
            :key="reply.id"
            :comment="reply"
            :depth="depth + 1"
            :highlight-comment-id="highlightCommentId"
            @replied="emit('replied')"
            @delete="(id) => emit('delete', id)"
            @liked="(payload) => emit('liked', payload)"
          />
        </div>
      </div>
    </div>
  </article>
</template>
