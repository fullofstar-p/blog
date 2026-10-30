<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import FileUploader from '@/components/FileUploader.vue'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import SketchButton from '@/components/SketchButton.vue'
import SketchInput from '@/components/SketchInput.vue'
import SketchLoading from '@/components/SketchLoading.vue'
import SketchModal from '@/components/SketchModal.vue'
import SketchTextarea from '@/components/SketchTextarea.vue'
import { createArticle, getArticle, updateArticle } from '@/api/article'
import { useMetaStore } from '@/store/meta'
import { formatDraftTime, readDraft, removeDraft, writeDraft } from '@/utils/articleDraft'
import { toastSuccess } from '@/utils/toast'

const props = defineProps({
  id: { type: String, default: '' }
})

const router = useRouter()
const meta = useMetaStore()

/** 本地草稿写入防抖；服务端草稿定时保存间隔（与「自动保存」文案一致） */
const LOCAL_DRAFT_DEBOUNCE = 700
const SERVER_AUTOSAVE_INTERVAL = 15000

const articleId = ref(props.id || '')
const isEdit = computed(() => Boolean(articleId.value))
// 编辑已有文章时初始就是加载态：数据回来之前不挂载表单，避免 MarkdownEditor
// 先挂载、再被 loading 置 true 卸载，Vditor 初始化未完成就 destroy 会抛错导致正文空白
const loading = ref(isEdit.value)
const loadError = ref('')
const saving = ref(false)
const autosaving = ref(false)
const saveError = ref('')

const editorRef = ref(null)

const form = reactive({
  title: '',
  summary: '',
  content: '',
  cover: '',
  categoryId: '',
  tagIds: [],
  status: 0,
  isTop: 0
})

const errors = reactive({ title: '', summary: '', content: '' })

// ---------- 自动保存状态 ----------
const autosaveState = ref('idle') // idle | local | saving | saved | error
const autosaveAt = ref(0)
const pendingDraft = ref(null)
const showDraftModal = ref(false)
const baseline = ref('')
const hydrating = ref(true)
let serverUpdatedAt = 0
let localTimer = null
let autosaveTimer = null
let autosavePromise = null

function formSnapshot() {
  return JSON.stringify({
    title: form.title,
    summary: form.summary,
    content: form.content,
    cover: form.cover,
    categoryId: form.categoryId,
    tagIds: [...form.tagIds],
    status: form.status,
    isTop: form.isTop
  })
}

const dirty = computed(() => formSnapshot() !== baseline.value)

const autosaveLabel = computed(() => {
  if (autosaveState.value === 'saving') return '正在自动保存…'
  if (autosaveState.value === 'error') return '自动保存失败，草稿已保留在本地'
  if (autosaveState.value === 'saved') return `已自动保存 ${formatDraftTime(autosaveAt.value)}`
  if (autosaveState.value === 'local') return `本地草稿已保存 ${formatDraftTime(autosaveAt.value)}`
  return dirty.value ? '有未保存修改' : ''
})

const autosaveTone = computed(() => {
  if (autosaveState.value === 'error') return 'text-sketchred'
  if (autosaveState.value === 'saved') return 'text-sketchgreen'
  return 'text-ink-500'
})

async function loadMeta() {
  try {
    await Promise.all([meta.loadCategories(), meta.loadTags()])
  } catch (err) {
    console.error('[admin] 分类/标签加载失败', err)
  }
}

function fill(data) {
  form.title = data.title || ''
  form.summary = data.summary || ''
  form.content = data.content || ''
  form.cover = data.cover || ''
  form.categoryId = data.categoryId ? String(data.categoryId) : ''
  form.tagIds = Array.isArray(data.tags) ? data.tags.map((tag) => tag.id) : []
  form.status = data.status === 1 ? 1 : 0
  form.isTop = data.isTop === 1 ? 1 : 0
}

function resetForm() {
  form.title = ''
  form.summary = ''
  form.content = ''
  form.cover = ''
  form.categoryId = ''
  form.tagIds = []
  form.status = 0
  form.isTop = 0
  baseline.value = formSnapshot()
}

function parseServerTime(value) {
  if (!value) return 0
  const time = new Date(String(value).replace(' ', 'T')).getTime()
  return Number.isNaN(time) ? 0 : time
}

async function loadArticle() {
  if (!props.id) return
  loading.value = true
  loadError.value = ''
  try {
    const data = await getArticle(props.id)
    articleId.value = String(props.id)
    fill(data)
    serverUpdatedAt = parseServerTime(data.updateTime)
    baseline.value = formSnapshot()
    autosaveState.value = 'idle'
  } catch (err) {
    loadError.value = (err && err.message) || '文章加载失败'
  } finally {
    loading.value = false
  }
}

// ---------- 本地草稿 ----------

function draftPayload() {
  return {
    articleId: articleId.value || '',
    savedAt: Date.now(),
    title: form.title,
    summary: form.summary,
    content: form.content,
    cover: form.cover,
    categoryId: form.categoryId,
    tagIds: [...form.tagIds],
    status: form.status,
    isTop: form.isTop
  }
}

/** 草稿按「当前页面」存键：/new 固定存 new，编辑页存文章 ID，刷新后一定找得到 */
function draftScope() {
  return props.id || ''
}

/** 立即写 localStorage（离开页面、beforeunload 时也会调用） */
function persistLocalDraft() {
  if (!form.title.trim() && !form.summary.trim() && !form.content.trim()) return
  const payload = draftPayload()
  if (!writeDraft(draftScope(), payload)) return
  autosaveState.value = 'local'
  autosaveAt.value = payload.savedAt
}

function scheduleLocalSave() {
  if (localTimer) clearTimeout(localTimer)
  localTimer = setTimeout(persistLocalDraft, LOCAL_DRAFT_DEBOUNCE)
}

function draftMatchesForm(draft) {
  return (
    draft.title === form.title &&
    draft.summary === form.summary &&
    draft.content === form.content &&
    draft.cover === form.cover &&
    String(draft.categoryId ?? '') === String(form.categoryId ?? '') &&
    draft.tagIds.length === form.tagIds.length &&
    draft.tagIds.every((id, index) => id === form.tagIds[index]) &&
    draft.status === form.status &&
    draft.isTop === form.isTop
  )
}

async function checkLocalDraft() {
  const draft = readDraft(draftScope())
  if (!draft) return
  if (draftMatchesForm(draft)) {
    removeDraft(draftScope())
    return
  }
  if (articleId.value) {
    // 服务端内容比本地草稿新：本地草稿已过期，直接丢弃
    if (draft.savedAt <= serverUpdatedAt + 1500) {
      removeDraft(draftScope())
      return
    }
  } else if (!draft.title.trim() && !draft.summary.trim() && !draft.content.trim()) {
    removeDraft(draftScope())
    return
  }
  pendingDraft.value = draft
  showDraftModal.value = true
}

function applyDraft() {
  const draft = pendingDraft.value
  if (!draft) return
  hydrating.value = true
  form.title = draft.title
  form.summary = draft.summary
  form.content = draft.content
  form.cover = draft.cover
  form.categoryId = draft.categoryId ?? ''
  form.tagIds = [...draft.tagIds]
  form.status = draft.status
  form.isTop = draft.isTop
  if (!articleId.value && draft.articleId) assignArticleId(draft.articleId)
  pendingDraft.value = null
  showDraftModal.value = false
  hydrating.value = false
  autosaveState.value = 'local'
  autosaveAt.value = draft.savedAt
  toastSuccess('已恢复本地草稿')
  scheduleLocalSave()
}

function discardDraft() {
  const draft = pendingDraft.value
  removeDraft(draftScope())
  if (draft && draft.articleId) removeDraft(draft.articleId)
  pendingDraft.value = null
  showDraftModal.value = false
  autosaveState.value = 'idle'
}

// ---------- 服务端自动保存 ----------

/**
 * 新文章第一次自动保存成功后记住服务端 ID，后续自动保存 / 手动保存都走更新。
 *
 * 这里刻意不做路由跳转：/articles/new 与 /articles/:id/edit 是两个路由记录，
 * replace 会卸载并重建整个编辑器（Vditor 重挂载，正在输入的内容会闪断）。
 * 刷新后通过本地草稿里保存的 articleId 也能找回这篇草稿。
 */
function assignArticleId(id) {
  if (!id) return
  articleId.value = String(id)
}

async function autosaveToServer() {
  if (autosaving.value || saving.value || hydrating.value || showDraftModal.value) return
  if (!dirty.value || form.status !== 0 || !form.title.trim()) return
  const snapshotAtStart = formSnapshot()
  autosaving.value = true
  autosaveState.value = 'saving'
  autosavePromise = (async () => {
    try {
      if (articleId.value) {
        await updateArticle(articleId.value, buildPayload(0))
      } else {
        const created = await createArticle(buildPayload(0))
        if (created && created.id) assignArticleId(created.id)
      }
      // 基线取「开始保存时」的快照：保存过程中继续输入的内容仍算未保存
      baseline.value = snapshotAtStart
      autosaveAt.value = Date.now()
      persistLocalDraft()
      autosaveState.value = 'saved'
    } catch (err) {
      autosaveState.value = 'error'
      console.warn('[admin] 自动保存失败', err)
    } finally {
      autosaving.value = false
    }
  })()
  await autosavePromise
  autosavePromise = null
}

function startAutosaveTimer() {
  stopAutosaveTimer()
  autosaveTimer = window.setInterval(autosaveToServer, SERVER_AUTOSAVE_INTERVAL)
}

function stopAutosaveTimer() {
  if (autosaveTimer) {
    clearInterval(autosaveTimer)
    autosaveTimer = null
  }
}

// ---------- 离开提醒 ----------

function onBeforeUnload(event) {
  if (!dirty.value || saving.value) return
  persistLocalDraft()
  event.preventDefault()
  event.returnValue = ''
}

onBeforeRouteLeave(() => {
  if (!dirty.value || saving.value) return true
  persistLocalDraft()
  return window.confirm('当前文章还有未保存的修改，确定离开吗？\n已自动保留本地草稿。')
})

watch(formSnapshot, () => {
  if (hydrating.value) return
  if (autosaveState.value === 'saved') autosaveState.value = 'idle'
  scheduleLocalSave()
})

// ---------- 表单操作 ----------

function validate(requireContent) {
  if (!form.title.trim()) errors.title = '请输入标题'
  else if (form.title.length > 200) errors.title = '标题不能超过 200 字'
  else errors.title = ''

  errors.summary = form.summary.length > 500 ? '摘要不能超过 500 字' : ''
  errors.content = requireContent && !form.content.trim() ? '发布前请填写正文' : ''

  return !errors.title && !errors.summary && !errors.content
}

function toggleTag(tagId) {
  const index = form.tagIds.indexOf(tagId)
  if (index >= 0) form.tagIds.splice(index, 1)
  else form.tagIds.push(tagId)
}

/** 导入 Markdown 后，标题还是空的话用文件里的第一个标题/文件名回填 */
function onImported(payload) {
  const suggested = String((payload && payload.title) || '').trim()
  if (!form.title.trim() && suggested) form.title = suggested.slice(0, 200)
}

function buildPayload(status) {
  return {
    title: form.title.trim(),
    summary: form.summary.trim() || undefined,
    content: form.content,
    cover: form.cover || undefined,
    categoryId: form.categoryId === '' ? null : Number(form.categoryId),
    tagIds: form.tagIds,
    status,
    isTop: form.isTop ? 1 : 0
  }
}

/** Vditor 的 input 回调有延迟，提交前强制同步一次最新正文，避免误判正文为空 */
function syncEditorContent() {
  const value = editorRef.value?.getMarkdown?.()
  if (typeof value === 'string' && value !== form.content) {
    form.content = value
  }
}

async function submit(status) {
  saveError.value = ''
  syncEditorContent()
  if (!validate(status === 1)) return
  saving.value = true
  try {
    // 手动保存前先等在途的自动保存结束，避免旧草稿请求后到达把发布状态覆盖回草稿
    if (autosavePromise) await autosavePromise
    const payload = buildPayload(status)
    if (articleId.value) {
      await updateArticle(articleId.value, payload)
    } else {
      const created = await createArticle(payload)
      if (created && created.id) articleId.value = String(created.id)
    }
    form.status = status
    baseline.value = formSnapshot()
    removeDraft(draftScope())
    toastSuccess(status === 1 ? '文章已发布' : '草稿已保存')
    router.push({ name: 'admin-articles' })
  } catch (err) {
    saveError.value = (err && err.message) || '保存失败，请稍后再试'
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await loadMeta()
  if (props.id) await loadArticle()
  else resetForm()
  hydrating.value = true
  await checkLocalDraft()
  hydrating.value = false
  startAutosaveTimer()
  window.addEventListener('beforeunload', onBeforeUnload)
})

watch(
  () => props.id,
  async (value) => {
    articleId.value = value ? String(value) : ''
    hydrating.value = true
    if (value) await loadArticle()
    else {
      resetForm()
      loading.value = false
    }
    await checkLocalDraft()
    hydrating.value = false
  }
)

onBeforeUnmount(() => {
  stopAutosaveTimer()
  if (localTimer) clearTimeout(localTimer)
  window.removeEventListener('beforeunload', onBeforeUnload)
})
</script>

<template>
  <div>
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <RouterLink :to="{ name: 'admin-articles' }" class="sketch-link font-serif text-sm italic">
          ← 返回文章管理
        </RouterLink>
        <h2 class="mt-1 font-serif text-2xl italic text-pencil md:text-3xl">
          {{ isEdit ? '编辑文章' : '写新文章' }}
        </h2>
        <p class="mt-1 font-serif text-sm italic text-ink-500">
          正文使用 Markdown 即时渲染；顶部菜单栏可插入标题/列表/表格/代码块，「文件」菜单可新建、导入 / 导出 Markdown（也支持把 .md 文件直接拖进编辑器），右侧「大纲」「源码」切换侧栏与 Markdown 源码模式，表格旁会浮出操作按钮，底部状态栏显示字数。草稿每 15 秒自动保存到服务端，同时在本浏览器保留一份本地草稿；已发布文章只保存本地草稿，不会自动改动线上内容。
        </p>
      </div>
      <div class="flex flex-col items-end gap-1">
        <span
          class="sketch-badge"
          :class="
            form.status === 1
              ? 'border-sketchgreen/60 text-sketchgreen'
              : 'border-sketchyellow/60 text-sketchyellow-deep'
          "
        >
          {{ form.status === 1 ? '当前：已发布' : '当前：草稿' }}
        </span>
        <span
          v-if="autosaveLabel"
          class="font-serif text-xs italic"
          :class="autosaveTone"
          role="status"
          aria-live="polite"
        >
          {{ autosaveLabel }}
        </span>
      </div>
    </div>

    <SketchLoading v-if="loading" :rows="3" label="正在加载文章" />

    <div
      v-else-if="loadError"
      class="mt-5 flex flex-col items-start gap-3 border-2 border-dashed border-sketchred/60 bg-paper-soft/70 p-5"
    >
      <p class="font-serif text-sm italic text-sketchred" role="alert">{{ loadError }}</p>
      <div class="flex flex-wrap gap-2">
        <button type="button" class="sketch-btn min-h-[44px] px-4" @click="loadArticle">重新加载</button>
        <RouterLink :to="{ name: 'admin-articles' }" class="sketch-btn min-h-[44px] px-4">
          返回列表
        </RouterLink>
      </div>
    </div>

    <form v-if="!loading && !loadError" class="mt-5 space-y-6" @submit.prevent="submit(1)">
      <section class="sketch-card rotate-[-0.2deg] p-5 md:p-6">
        <h3 class="font-serif text-xl italic text-pencil">基本信息</h3>

        <div class="mt-4 space-y-4">
          <SketchInput
            v-model="form.title"
            label="标题"
            placeholder="给这篇笔记起个标题"
            required
            :error="errors.title"
            maxlength="200"
          />

          <SketchTextarea
            v-model="form.summary"
            label="摘要"
            placeholder="留空时后端会取正文前 120 字"
            :rows="3"
            maxlength="500"
            :error="errors.summary"
            hint="最多 500 字"
          />

          <div class="grid gap-4 md:grid-cols-2">
            <div>
              <label for="article-category" class="sketch-label">分类</label>
              <select id="article-category" v-model="form.categoryId" class="sketch-input">
                <option value="">未分类</option>
                <option
                  v-for="category in meta.categories"
                  :key="category.id"
                  :value="String(category.id)"
                >
                  {{ category.name }}
                </option>
              </select>
            </div>

            <div>
              <span class="sketch-label">置顶</span>
              <button
                type="button"
                class="inline-flex min-h-[44px] w-full items-center justify-center border-2 border-dashed px-4 font-serif text-sm italic transition-all duration-150 hover:bg-pencil hover:text-paper"
                :class="form.isTop ? 'border-pencil bg-pencil text-paper' : 'border-pencil/60 text-pencil'"
                :aria-pressed="form.isTop ? 'true' : 'false'"
                @click="form.isTop = form.isTop ? 0 : 1"
              >
                {{ form.isTop ? '★ 已置顶（点击取消）' : '☆ 设置为置顶' }}
              </button>
            </div>
          </div>

          <div>
            <span class="sketch-label">标签</span>
            <div v-if="meta.tags.length === 0" class="font-serif text-sm italic text-ink-300">
              还没有标签，先去「标签管理」创建。
            </div>
            <div v-else class="flex flex-wrap gap-2">
              <button
                v-for="tag in meta.tags"
                :key="tag.id"
                type="button"
                class="inline-flex min-h-[44px] items-center gap-1 border-2 border-dashed px-3 font-serif text-sm italic transition-all duration-150 hover:-rotate-1 hover:bg-pencil hover:text-paper active:translate-y-[1px]"
                :class="
                  form.tagIds.includes(tag.id)
                    ? 'border-pencil bg-pencil text-paper'
                    : 'border-pencil/60 text-pencil'
                "
                :aria-pressed="form.tagIds.includes(tag.id) ? 'true' : 'false'"
                @click="toggleTag(tag.id)"
              >
                # {{ tag.name }}
              </button>
            </div>
          </div>

          <FileUploader
            v-model="form.cover"
            category="cover"
            label="封面图"
            hint="可选；建议使用 16:9 横图"
            preview-class="max-h-48"
          />
        </div>
      </section>

      <section class="sketch-card rotate-[0.2deg] p-5 md:p-6">
        <h3 class="font-serif text-xl italic text-pencil">正文</h3>
        <p v-if="errors.content" class="mt-2 font-serif text-sm italic text-sketchred" role="alert">
          {{ errors.content }}
        </p>
        <div class="mt-4">
          <MarkdownEditor
            ref="editorRef"
            v-model="form.content"
            :file-name="form.title"
            placeholder="用 Markdown 写正文；图片可直接粘贴或拖入编辑器…"
            :min-height="520"
            @import-file="onImported"
          />
        </div>
      </section>

      <p
        v-if="saveError"
        class="border-l-2 border-dashed border-sketchred pl-3 font-serif text-sm italic text-sketchred"
        role="alert"
      >
        {{ saveError }}
      </p>

      <div class="flex flex-wrap items-center gap-3">
        <SketchButton type="submit" variant="primary" :loading="saving">
          {{ isEdit ? '保存并发布' : '发布文章' }}
        </SketchButton>
        <SketchButton type="button" :disabled="saving" @click="submit(0)">保存草稿</SketchButton>
        <SketchButton type="button" variant="ghost" :disabled="saving" @click="router.push({ name: 'admin-articles' })">
          取消
        </SketchButton>
      </div>
    </form>

    <SketchModal v-model="showDraftModal" title="发现未保存的草稿">
      <p class="font-serif text-sm leading-relaxed text-ink-700">
        检测到
        {{ pendingDraft && pendingDraft.articleId ? '这篇文章' : '一篇新文章' }}
        在本浏览器还有未保存的草稿，保存于
        {{ pendingDraft ? formatDraftTime(pendingDraft.savedAt) : '—' }}。
      </p>
      <p v-if="pendingDraft && pendingDraft.title" class="mt-2 font-serif text-sm italic text-ink-700">
        标题：{{ pendingDraft.title }}
      </p>
      <p class="mt-3 border-l-2 border-dashed border-pencil/60 pl-3 font-serif text-sm italic text-ink-500">
        恢复后会覆盖当前编辑器内容，并继续自动保存；丢弃则保留服务端现有内容。
      </p>
      <template #footer>
        <SketchButton variant="ghost" @click="discardDraft">丢弃草稿</SketchButton>
        <SketchButton variant="primary" @click="applyDraft">恢复草稿</SketchButton>
      </template>
    </SketchModal>
  </div>
</template>
