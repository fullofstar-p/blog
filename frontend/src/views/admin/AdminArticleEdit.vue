<script setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import FileUploader from '@/components/FileUploader.vue'
import MarkdownEditor from '@/components/MarkdownEditor.vue'
import SketchButton from '@/components/SketchButton.vue'
import SketchInput from '@/components/SketchInput.vue'
import SketchLoading from '@/components/SketchLoading.vue'
import SketchTextarea from '@/components/SketchTextarea.vue'
import { createArticle, getArticle, updateArticle } from '@/api/article'
import { useMetaStore } from '@/store/meta'
import { toastSuccess } from '@/utils/toast'

const props = defineProps({
  id: { type: String, default: '' }
})

const router = useRouter()
const meta = useMetaStore()

const isEdit = computed(() => Boolean(props.id))
// 编辑已有文章时初始就是加载态：数据回来之前不挂载表单，避免 MarkdownEditor
// 先挂载、再被 loading 置 true 卸载，Vditor 初始化未完成就 destroy 会抛错导致正文空白
const loading = ref(isEdit.value)
const loadError = ref('')
const saving = ref(false)
const saveError = ref('')

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

async function loadArticle() {
  if (!isEdit.value) return
  loading.value = true
  loadError.value = ''
  try {
    const data = await getArticle(props.id)
    fill(data)
  } catch (err) {
    loadError.value = (err && err.message) || '文章加载失败'
  } finally {
    loading.value = false
  }
}

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

async function submit(status) {
  saveError.value = ''
  if (!validate(status === 1)) return
  saving.value = true
  try {
    const payload = buildPayload(status)
    if (isEdit.value) await updateArticle(props.id, payload)
    else await createArticle(payload)
    form.status = status
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
  await loadArticle()
})

watch(
  () => props.id,
  async (value) => {
    if (value) await loadArticle()
  }
)
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
          正文使用 Markdown 即时渲染；顶部菜单栏可插入标题/列表/表格/代码块，右侧「大纲」「源码」切换侧栏与 Markdown 源码模式，表格旁会浮出操作按钮，底部状态栏显示字数。
        </p>
      </div>
      <span
        class="sketch-badge"
        :class="
          form.status === 1
            ? 'border-[#1f7a4d]/60 text-[#1f7a4d]'
            : 'border-[#9a6a00]/60 text-[#7a5300]'
        "
      >
        {{ form.status === 1 ? '当前：已发布' : '当前：草稿' }}
      </span>
    </div>

    <SketchLoading v-if="loading" :rows="3" label="正在加载文章" />

    <div
      v-else-if="loadError"
      class="mt-5 flex flex-col items-start gap-3 border-2 border-dashed border-[#b23b2e]/60 bg-paper-soft/70 p-5"
    >
      <p class="font-serif text-sm italic text-[#b23b2e]" role="alert">{{ loadError }}</p>
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
        <p v-if="errors.content" class="mt-2 font-serif text-sm italic text-[#b23b2e]" role="alert">
          {{ errors.content }}
        </p>
        <div class="mt-4">
          <MarkdownEditor
            v-model="form.content"
            placeholder="用 Markdown 写正文；图片可直接粘贴或拖入编辑器…"
            :min-height="520"
          />
        </div>
      </section>

      <p
        v-if="saveError"
        class="border-l-2 border-dashed border-[#b23b2e] pl-3 font-serif text-sm italic text-[#b23b2e]"
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
  </div>
</template>
