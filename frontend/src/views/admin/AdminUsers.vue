<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import SketchButton from '@/components/SketchButton.vue'
import SketchEmpty from '@/components/SketchEmpty.vue'
import SketchLoading from '@/components/SketchLoading.vue'
import SketchModal from '@/components/SketchModal.vue'
import SketchPagination from '@/components/SketchPagination.vue'
import { listAdminUsers, updateUserRole, updateUserStatus } from '@/api/admin'
import { useAuthStore } from '@/store/auth'
import { formatDate } from '@/utils/format'
import { toastSuccess } from '@/utils/toast'

const auth = useAuthStore()

const filters = reactive({ keyword: '', role: '', status: '' })
const users = ref([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = 10
const loading = ref(false)
const error = ref('')
const processingId = ref(null)
const confirmTarget = ref(null)

const confirmTitle = computed(() => {
  if (!confirmTarget.value) return ''
  return confirmTarget.value.action === 'role' ? '变更用户角色' : '变更用户状态'
})

const confirmMessage = computed(() => {
  if (!confirmTarget.value) return ''
  const { user, action } = confirmTarget.value
  if (action === 'role') {
    const next = user.role === 'ADMIN' ? 'USER' : 'ADMIN'
    return `确定要把「${user.nickname || user.username}」的角色改为 ${next} 吗？`
  }
  const next = user.status === 1 ? '禁用' : '启用'
  return `确定要${next}用户「${user.nickname || user.username}」吗？`
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const params = { pageNum: pageNum.value, pageSize }
    if (filters.keyword.trim()) params.keyword = filters.keyword.trim()
    if (filters.role !== '') params.role = filters.role
    if (filters.status !== '') params.status = Number(filters.status)
    const data = await listAdminUsers(params)
    users.value = (data && data.records) || []
    total.value = (data && data.total) || 0
  } catch (err) {
    error.value = (err && err.message) || '用户列表加载失败'
    users.value = []
  } finally {
    loading.value = false
  }
}

function submitFilters() {
  pageNum.value = 1
  load()
}

function resetFilters() {
  filters.keyword = ''
  filters.role = ''
  filters.status = ''
  pageNum.value = 1
  load()
}

function changePage(page) {
  if (page === pageNum.value) return
  pageNum.value = page
  load()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function isSelf(user) {
  return Boolean(auth.user && auth.user.id === user.id)
}

function askRoleChange(user) {
  if (isSelf(user)) return
  confirmTarget.value = { user, action: 'role' }
}

function askStatusChange(user) {
  if (isSelf(user)) return
  confirmTarget.value = { user, action: 'status' }
}

async function confirmAction() {
  if (!confirmTarget.value) return
  const { user, action } = confirmTarget.value
  processingId.value = user.id
  try {
    if (action === 'role') {
      await updateUserRole(user.id, user.role === 'ADMIN' ? 'USER' : 'ADMIN')
      toastSuccess('角色已更新')
    } else {
      await updateUserStatus(user.id, user.status === 1 ? 0 : 1)
      toastSuccess('状态已更新')
    }
    confirmTarget.value = null
    load()
  } catch (err) {
    console.error('[admin] 更新用户失败', err)
  } finally {
    processingId.value = null
  }
}

onMounted(load)
</script>

<template>
  <div>
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 class="font-serif text-2xl italic text-pencil md:text-3xl">用户管理</h2>
        <p class="mt-1 font-serif text-sm italic text-ink-500">共 {{ total }} 位注册用户</p>
      </div>
    </div>

    <form
      class="mt-5 flex flex-col gap-3 border-2 border-dashed border-pencil/50 bg-paper-soft/60 p-4 md:flex-row md:items-end"
      @submit.prevent="submitFilters"
    >
      <div class="w-full flex-1">
        <label for="admin-user-keyword" class="sketch-label">关键词</label>
        <input
          id="admin-user-keyword"
          v-model="filters.keyword"
          type="search"
          class="sketch-input"
          placeholder="用户名 / 昵称 / 邮箱"
        />
      </div>
      <div class="w-full md:w-36">
        <label for="admin-user-role" class="sketch-label">角色</label>
        <select id="admin-user-role" v-model="filters.role" class="sketch-input">
          <option value="">全部</option>
          <option value="ADMIN">ADMIN</option>
          <option value="USER">USER</option>
        </select>
      </div>
      <div class="w-full md:w-36">
        <label for="admin-user-status" class="sketch-label">状态</label>
        <select id="admin-user-status" v-model="filters.status" class="sketch-input">
          <option value="">全部</option>
          <option value="1">启用</option>
          <option value="0">禁用</option>
        </select>
      </div>
      <div class="flex gap-2">
        <SketchButton type="submit" variant="primary">筛选</SketchButton>
        <SketchButton type="button" variant="ghost" @click="resetFilters">重置</SketchButton>
      </div>
    </form>

    <SketchLoading v-if="loading" :rows="3" label="正在加载用户" />

    <div
      v-else-if="error"
      class="mt-5 flex flex-col items-start gap-3 border-2 border-dashed border-[#b23b2e]/60 bg-paper-soft/70 p-5"
    >
      <p class="font-serif text-sm italic text-[#b23b2e]" role="alert">{{ error }}</p>
      <button type="button" class="sketch-btn min-h-[44px] px-4" @click="load">重新加载</button>
    </div>

    <SketchEmpty
      v-else-if="users.length === 0"
      title="没有匹配的用户"
      description="换个筛选条件再试试。"
      icon="☺"
    />

    <div v-else class="mt-5 overflow-x-auto border-2 border-dashed border-pencil/50 bg-paper-soft/40 p-2">
      <table class="w-full min-w-[760px] border-collapse text-left">
        <caption class="sr-only">用户列表</caption>
        <thead>
          <tr class="border-b-2 border-dashed border-pencil/60 font-serif text-sm italic text-ink-700">
            <th class="px-3 py-3">用户</th>
            <th class="px-3 py-3">邮箱</th>
            <th class="px-3 py-3">角色</th>
            <th class="px-3 py-3">状态</th>
            <th class="px-3 py-3">注册时间</th>
            <th class="px-3 py-3 text-right">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="user in users"
            :key="user.id"
            class="border-b border-dashed border-pencil/30 align-middle font-serif text-sm text-ink-700"
          >
            <td class="px-3 py-3">
              <div class="flex items-center gap-2">
                <img
                  v-if="user.avatar"
                  :src="user.avatar"
                  alt=""
                  class="h-8 w-8 border border-dashed border-pencil/50 object-cover"
                />
                <span
                  v-else
                  class="inline-flex h-8 w-8 items-center justify-center border border-dashed border-pencil/50 font-serif text-xs italic text-ink-500"
                  aria-hidden="true"
                >
                  {{ (user.nickname || user.username || '?').slice(0, 1) }}
                </span>
                <div>
                  <p class="font-serif text-sm italic text-pencil">
                    {{ user.nickname || user.username }}
                    <span v-if="isSelf(user)" class="ml-1 text-xs text-ink-300">（当前账号）</span>
                  </p>
                  <p class="font-serif text-xs text-ink-300">@{{ user.username }}</p>
                </div>
              </div>
            </td>
            <td class="px-3 py-3">{{ user.email || '—' }}</td>
            <td class="px-3 py-3">
              <span class="sketch-badge" :class="user.role === 'ADMIN' ? 'border-[#2b6e96]/60 text-[#2b6e96]' : ''">
                {{ user.role }}
              </span>
            </td>
            <td class="px-3 py-3">
              <span
                class="sketch-badge"
                :class="user.status === 1 ? 'border-[#1f7a4d]/60 text-[#1f7a4d]' : 'border-[#b23b2e]/60 text-[#b23b2e]'"
              >
                {{ user.status === 1 ? '启用' : '禁用' }}
              </span>
            </td>
            <td class="px-3 py-3">{{ formatDate(user.createTime) }}</td>
            <td class="px-3 py-3">
              <div class="flex flex-wrap justify-end gap-1">
                <button
                  type="button"
                  class="inline-flex min-h-[44px] items-center border-2 border-dashed border-pencil/60 px-2 font-serif text-xs italic text-pencil transition-colors hover:bg-pencil hover:text-paper disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-paper disabled:hover:text-pencil"
                  :disabled="isSelf(user) || processingId === user.id"
                  :title="isSelf(user) ? '不能修改自己的角色' : '切换角色'"
                  @click="askRoleChange(user)"
                >
                  {{ user.role === 'ADMIN' ? '降为 USER' : '升为 ADMIN' }}
                </button>
                <button
                  type="button"
                  class="inline-flex min-h-[44px] items-center border-2 border-dashed border-pencil/60 px-2 font-serif text-xs italic text-pencil transition-colors hover:bg-pencil hover:text-paper disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-paper disabled:hover:text-pencil"
                  :disabled="isSelf(user) || processingId === user.id"
                  :title="isSelf(user) ? '不能禁用自己' : '切换状态'"
                  @click="askStatusChange(user)"
                >
                  {{ user.status === 1 ? '禁用' : '启用' }}
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
      :model-value="Boolean(confirmTarget)"
      :title="confirmTitle"
      @update:model-value="confirmTarget = null"
    >
      <p class="font-serif text-sm leading-relaxed text-ink-700">{{ confirmMessage }}</p>
      <template #footer>
        <SketchButton variant="ghost" @click="confirmTarget = null">取消</SketchButton>
        <SketchButton :loading="Boolean(processingId)" @click="confirmAction">确认变更</SketchButton>
      </template>
    </SketchModal>
  </div>
</template>
