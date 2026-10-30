<script setup>
import { onMounted, reactive, ref } from 'vue'
import SketchButton from '@/components/SketchButton.vue'
import SketchEmpty from '@/components/SketchEmpty.vue'
import SketchInput from '@/components/SketchInput.vue'
import SketchLoading from '@/components/SketchLoading.vue'
import SketchModal from '@/components/SketchModal.vue'
import { createTag, deleteTag, updateTag } from '@/api/admin'
import { listTags } from '@/api/tag'
import { toastSuccess } from '@/utils/toast'

const tags = ref([])
const loading = ref(false)
const error = ref('')

const modalOpen = ref(false)
const editingId = ref(null)
const form = reactive({ name: '' })
const formError = ref('')
const saving = ref(false)

const deleteTarget = ref(null)
const deleting = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await listTags()
    tags.value = Array.isArray(data) ? data : []
  } catch (err) {
    error.value = (err && err.message) || '标签加载失败'
    tags.value = []
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  form.name = ''
  formError.value = ''
  modalOpen.value = true
}

function openEdit(tag) {
  editingId.value = tag.id
  form.name = tag.name
  formError.value = ''
  modalOpen.value = true
}

async function save() {
  formError.value = ''
  const name = form.name.trim()
  if (!name) {
    formError.value = '请输入标签名'
    return
  }
  if (name.length > 50) {
    formError.value = '标签名不能超过 50 个字符'
    return
  }
  saving.value = true
  try {
    const payload = { name }
    if (editingId.value) await updateTag(editingId.value, payload)
    else await createTag(payload)
    toastSuccess(editingId.value ? '标签已更新' : '标签已创建')
    modalOpen.value = false
    load()
  } catch (err) {
    formError.value = (err && err.message) || '保存失败'
  } finally {
    saving.value = false
  }
}

function askDelete(tag) {
  deleteTarget.value = tag
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await deleteTag(deleteTarget.value.id)
    toastSuccess('标签已删除')
    deleteTarget.value = null
    load()
  } catch (err) {
    console.error('[admin] 删除标签失败', err)
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
        <h2 class="font-serif text-2xl italic text-pencil md:text-3xl">标签管理</h2>
        <p class="mt-1 font-serif text-sm italic text-ink-500">
          标签与文章多对多；删除标签会解除它与文章的关联。
        </p>
      </div>
      <SketchButton type="button" variant="primary" @click="openCreate">+ 新建标签</SketchButton>
    </div>

    <SketchLoading v-if="loading" :rows="2" label="正在加载标签" />

    <div
      v-else-if="error"
      class="mt-5 flex flex-col items-start gap-3 border-2 border-dashed border-sketchred/60 bg-paper-soft/70 p-5"
    >
      <p class="font-serif text-sm italic text-sketchred" role="alert">{{ error }}</p>
      <button type="button" class="sketch-btn min-h-[44px] px-4" @click="load">重新加载</button>
    </div>

    <SketchEmpty
      v-else-if="tags.length === 0"
      title="还没有标签"
      description="创建几个标签，给文章做更细的归类。"
      icon="#"
    >
      <SketchButton type="button" variant="primary" @click="openCreate">新建标签</SketchButton>
    </SketchEmpty>

    <div v-else class="mt-5 flex flex-wrap gap-3">
      <div
        v-for="tag in tags"
        :key="tag.id"
        class="flex min-h-[44px] items-center gap-2 border-2 border-dashed border-pencil/60 bg-paper px-3 py-2 shadow-sketchsm"
      >
        <span class="font-serif text-sm italic text-pencil">
          <span class="text-sketchblue" aria-hidden="true">#</span> {{ tag.name }}
          <span class="ml-1 text-xs text-ink-300">{{ tag.articleCount ?? 0 }} 篇</span>
        </span>
        <div class="flex gap-1">
          <button
            type="button"
            class="inline-flex h-11 min-w-[44px] items-center justify-center border border-dashed border-pencil/50 px-2 font-serif text-xs italic text-pencil transition-colors hover:bg-pencil hover:text-paper"
            @click="openEdit(tag)"
          >
            编辑
          </button>
          <button
            type="button"
            class="inline-flex h-11 min-w-[44px] items-center justify-center border border-dashed border-sketchred/60 px-2 font-serif text-xs italic text-sketchred transition-colors hover:bg-sketchred hover:text-paper"
            @click="askDelete(tag)"
          >
            删除
          </button>
        </div>
      </div>
    </div>

    <SketchModal v-model="modalOpen" :title="editingId ? '编辑标签' : '新建标签'">
      <SketchInput v-model="form.name" label="标签名" placeholder="例如：Spring Boot" required />
      <p
        v-if="formError"
        class="mt-3 border-l-2 border-dashed border-sketchred pl-3 font-serif text-sm italic text-sketchred"
        role="alert"
      >
        {{ formError }}
      </p>
      <template #footer>
        <SketchButton variant="ghost" @click="modalOpen = false">取消</SketchButton>
        <SketchButton :loading="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</SketchButton>
      </template>
    </SketchModal>

    <SketchModal
      :model-value="Boolean(deleteTarget)"
      title="删除标签"
      @update:model-value="deleteTarget = null"
    >
      <p class="font-serif text-sm leading-relaxed text-ink-700">
        确定要删除「{{ deleteTarget ? deleteTarget.name : '' }}」吗？文章与它的关联会一并解除。
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
