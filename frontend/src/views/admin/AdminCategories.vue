<script setup>
import { onMounted, reactive, ref } from 'vue'
import SketchButton from '@/components/SketchButton.vue'
import SketchEmpty from '@/components/SketchEmpty.vue'
import SketchInput from '@/components/SketchInput.vue'
import SketchLoading from '@/components/SketchLoading.vue'
import SketchModal from '@/components/SketchModal.vue'
import { createCategory, deleteCategory, updateCategory } from '@/api/admin'
import { listCategories } from '@/api/category'
import { toastSuccess } from '@/utils/toast'

const categories = ref([])
const loading = ref(false)
const error = ref('')

const modalOpen = ref(false)
const editingId = ref(null)
const form = reactive({ name: '', sort: 0 })
const formError = ref('')
const saving = ref(false)

const deleteTarget = ref(null)
const deleting = ref(false)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await listCategories()
    categories.value = Array.isArray(data) ? data : []
  } catch (err) {
    error.value = (err && err.message) || '分类加载失败'
    categories.value = []
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingId.value = null
  form.name = ''
  form.sort = categories.value.length * 10
  formError.value = ''
  modalOpen.value = true
}

function openEdit(category) {
  editingId.value = category.id
  form.name = category.name
  form.sort = category.sort
  formError.value = ''
  modalOpen.value = true
}

async function save() {
  formError.value = ''
  const name = form.name.trim()
  if (!name) {
    formError.value = '请输入分类名'
    return
  }
  if (name.length > 50) {
    formError.value = '分类名不能超过 50 个字符'
    return
  }
  saving.value = true
  try {
    const payload = { name, sort: Number(form.sort) || 0 }
    if (editingId.value) await updateCategory(editingId.value, payload)
    else await createCategory(payload)
    toastSuccess(editingId.value ? '分类已更新' : '分类已创建')
    modalOpen.value = false
    load()
  } catch (err) {
    formError.value = (err && err.message) || '保存失败'
  } finally {
    saving.value = false
  }
}

function askDelete(category) {
  deleteTarget.value = category
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await deleteCategory(deleteTarget.value.id)
    toastSuccess('分类已删除')
    deleteTarget.value = null
    load()
  } catch (err) {
    console.error('[admin] 删除分类失败', err)
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
        <h2 class="font-serif text-2xl italic text-pencil md:text-3xl">分类管理</h2>
        <p class="mt-1 font-serif text-sm italic text-ink-500">
          文章与分类是一对多关系；被文章引用的分类不能直接删除。
        </p>
      </div>
      <SketchButton type="button" variant="primary" @click="openCreate">+ 新建分类</SketchButton>
    </div>

    <SketchLoading v-if="loading" :rows="2" label="正在加载分类" />

    <div
      v-else-if="error"
      class="mt-5 flex flex-col items-start gap-3 border-2 border-dashed border-sketchred/60 bg-paper-soft/70 p-5"
    >
      <p class="font-serif text-sm italic text-sketchred" role="alert">{{ error }}</p>
      <button type="button" class="sketch-btn min-h-[44px] px-4" @click="load">重新加载</button>
    </div>

    <SketchEmpty
      v-else-if="categories.length === 0"
      title="还没有分类"
      description="先创建几个分类，写文章时就可以归档了。"
      icon="◈"
    >
      <SketchButton type="button" variant="primary" @click="openCreate">新建分类</SketchButton>
    </SketchEmpty>

    <div v-else class="mt-5 grid gap-4 md:grid-cols-2 md:gap-6">
      <article
        v-for="category in categories"
        :key="category.id"
        class="sketch-card flex flex-wrap items-center justify-between gap-3 p-5"
      >
        <div>
          <h3 class="font-serif text-lg italic text-pencil">
            <span class="text-sketchred" aria-hidden="true">◈</span> {{ category.name }}
          </h3>
          <p class="mt-1 font-serif text-xs italic text-ink-300">
            排序 {{ category.sort }} · 文章 {{ category.articleCount ?? 0 }} 篇
          </p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="sketch-btn sketch-btn-sm min-h-[44px] px-3 text-sm"
            @click="openEdit(category)"
          >
            编辑
          </button>
          <button
            type="button"
            class="sketch-btn sketch-btn-danger sketch-btn-sm min-h-[44px] px-3 text-sm"
            @click="askDelete(category)"
          >
            删除
          </button>
        </div>
      </article>
    </div>

    <SketchModal v-model="modalOpen" :title="editingId ? '编辑分类' : '新建分类'">
      <div class="space-y-4">
        <SketchInput v-model="form.name" label="分类名" placeholder="例如：后端开发" required />
        <SketchInput
          v-model.number="form.sort"
          label="排序值"
          type="number"
          hint="数字越小越靠前"
        />
      </div>
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
      title="删除分类"
      @update:model-value="deleteTarget = null"
    >
      <p class="font-serif text-sm leading-relaxed text-ink-700">
        确定要删除「{{ deleteTarget ? deleteTarget.name : '' }}」吗？如果仍有文章引用，后端会拒绝并提示。
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
