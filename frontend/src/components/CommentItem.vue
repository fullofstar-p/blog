<script setup>
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { createComment, likeComment, unlikeComment } from '@/api/comment'
import { useAuthStore } from '@/store/auth'
import { timeAgo } from '@/utils/format'
import { pushToast, toastError, toastSuccess } from '@/utils/toast'

const props = defineProps({
  comment: { type: Object, required: true },
  depth: { type: Number, default: 0 }
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
    const parentId = isReply.value
      ? props.comment.parentId || props.comment.id
      : props.comment.id
    await createComment({ articleId: props.comment.articleId, parentId, content })
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
    class="border-l-2 border-dashed border-pencil/40 pl-3 sm:pl-4"
    :class="isReply ? 'ml-2 sm:ml-6' : ''"
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

        <p class="mt-1 whitespace-pre-line font-serif text-sm leading-relaxed text-ink-700">
          {{ comment.content }}
        </p>

        <div class="mt-1 flex flex-wrap items-center gap-1">
          <button
            type="button"
            class="inline-flex min-h-[44px] items-center gap-1 border-2 border-dashed px-2 font-serif text-xs italic transition-colors"
            :class="
              liked
                ? 'border-[#b23b2e]/60 text-[#b23b2e]'
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
            v-if="!isReply"
            type="button"
            class="inline-flex min-h-[44px] items-center border-2 border-dashed border-transparent px-2 font-serif text-xs italic text-ink-500 transition-colors hover:border-pencil/50 hover:bg-pencil hover:text-paper"
            @click="toggleReply"
          >
            回复
          </button>

          <button
            v-if="canDelete"
            type="button"
            class="inline-flex min-h-[44px] items-center border-2 border-dashed border-transparent px-2 font-serif text-xs italic text-[#b23b2e] transition-colors hover:border-[#b23b2e] hover:bg-[#b23b2e] hover:text-paper"
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
            @replied="emit('replied')"
            @delete="(id) => emit('delete', id)"
            @liked="(payload) => emit('liked', payload)"
          />
        </div>
      </div>
    </div>
  </article>
</template>
