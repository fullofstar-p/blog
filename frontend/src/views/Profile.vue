<script setup>
import { onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ArticleCard from '@/components/ArticleCard.vue'
import FileUploader from '@/components/FileUploader.vue'
import SketchButton from '@/components/SketchButton.vue'
import SketchEmpty from '@/components/SketchEmpty.vue'
import SketchInput from '@/components/SketchInput.vue'
import SketchLoading from '@/components/SketchLoading.vue'
import SketchModal from '@/components/SketchModal.vue'
import SketchPagination from '@/components/SketchPagination.vue'
import { deleteArticle, getMyArticles, getMyFavorites, unfavoriteArticle } from '@/api/article'
import { useAuthStore } from '@/store/auth'
import { formatDate, formatViews } from '@/utils/format'
import { toastSuccess } from '@/utils/toast'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const tabs = [
  { key: 'profile', label: '个人资料' },
  { key: 'security', label: '账号安全' },
  { key: 'articles', label: '我的文章' },
  { key: 'favorites', label: '我的收藏' }
]
const tabKeys = tabs.map((tab) => tab.key)
const initialTab =
  typeof route.query.tab === 'string' && tabKeys.includes(route.query.tab)
    ? route.query.tab
    : 'profile'
const activeTab = ref(initialTab)

// ---------- 资料 ----------
const profileForm = reactive({ nickname: '', email: '', avatar: '' })
const profileErrors = reactive({ nickname: '', email: '' })
const profileLoading = ref(false)
const profileSaving = ref(false)

function fillProfile() {
  profileForm.nickname = (auth.user && auth.user.nickname) || ''
  profileForm.email = (auth.user && auth.user.email) || ''
  profileForm.avatar = (auth.user && auth.user.avatar) || ''
}

async function loadProfile() {
  profileLoading.value = true
  try {
    await auth.loadMe()
    fillProfile()
  } catch (err) {
    console.error('[profile] 刷新资料失败', err)
  } finally {
    profileLoading.value = false
  }
}

function validateProfile() {
  profileErrors.nickname = profileForm.nickname.length > 50 ? '昵称不能超过 50 个字符' : ''
  const email = profileForm.email.trim()
  profileErrors.email =
    email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '邮箱格式不正确' : ''
  return !profileErrors.nickname && !profileErrors.email
}

async function saveProfile() {
  if (!validateProfile()) return
  profileSaving.value = true
  try {
    await auth.updateProfile({
      nickname: profileForm.nickname.trim(),
      email: profileForm.email.trim(),
      avatar: profileForm.avatar
    })
    fillProfile()
    toastSuccess('资料已保存')
  } catch (err) {
    console.error('[profile] 保存资料失败', err)
  } finally {
    profileSaving.value = false
  }
}

function onAvatarUploaded() {
  toastSuccess('头像已上传，别忘了点击「保存资料」')
}

// ---------- 密码 ----------
const passwordForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const passwordErrors = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })
const passwordSaving = ref(false)

function validatePassword() {
  passwordErrors.oldPassword = passwordForm.oldPassword ? '' : '请输入当前密码'
  passwordErrors.newPassword =
    passwordForm.newPassword.length >= 6 && passwordForm.newPassword.length <= 32
      ? ''
      : '新密码需为 6-32 位'
  passwordErrors.confirmPassword =
    passwordForm.confirmPassword === passwordForm.newPassword ? '' : '两次输入的新密码不一致'
  return Object.values(passwordErrors).every((item) => !item)
}

async function savePassword() {
  if (!validatePassword()) return
  passwordSaving.value = true
  try {
    await auth.updatePassword({
      oldPassword: passwordForm.oldPassword,
      newPassword: passwordForm.newPassword
    })
    passwordForm.oldPassword = ''
    passwordForm.newPassword = ''
    passwordForm.confirmPassword = ''
    toastSuccess('密码已修改，请妥善保管')
  } catch (err) {
    console.error('[profile] 修改密码失败', err)
  } finally {
    passwordSaving.value = false
  }
}

// ---------- 我的文章 ----------
const myArticles = ref([])
const myTotal = ref(0)
const myPage = ref(1)
const myPageSize = 8
const myStatus = ref('')
const myLoading = ref(false)
const myError = ref('')
const deleteTarget = ref(null)
const deleting = ref(false)

async function loadMyArticles() {
  myLoading.value = true
  myError.value = ''
  try {
    const params = { pageNum: myPage.value, pageSize: myPageSize }
    if (myStatus.value !== '') params.status = Number(myStatus.value)
    const data = await getMyArticles(params)
    myArticles.value = (data && data.records) || []
    myTotal.value = (data && data.total) || 0
  } catch (err) {
    myError.value = (err && err.message) || '我的文章加载失败'
    myArticles.value = []
  } finally {
    myLoading.value = false
  }
}

function changeMyStatus(value) {
  if (myStatus.value === value) return
  myStatus.value = value
  myPage.value = 1
  loadMyArticles()
}

function changeMyPage(page) {
  if (page === myPage.value) return
  myPage.value = page
  loadMyArticles()
}

function askDelete(article) {
  deleteTarget.value = article
}

async function confirmDelete() {
  if (!deleteTarget.value) return
  deleting.value = true
  try {
    await deleteArticle(deleteTarget.value.id)
    toastSuccess('文章已删除')
    deleteTarget.value = null
    loadMyArticles()
  } catch (err) {
    console.error('[profile] 删除文章失败', err)
  } finally {
    deleting.value = false
  }
}

// ---------- 我的收藏 ----------
const favoriteArticles = ref([])
const favoriteTotal = ref(0)
const favoritePage = ref(1)
const favoritePageSize = 8
const favoriteLoading = ref(false)
const favoriteError = ref('')
const cancellingId = ref(null)

async function loadFavorites() {
  favoriteLoading.value = true
  favoriteError.value = ''
  try {
    const data = await getMyFavorites({
      pageNum: favoritePage.value,
      pageSize: favoritePageSize
    })
    favoriteArticles.value = (data && data.records) || []
    favoriteTotal.value = (data && data.total) || 0
  } catch (err) {
    favoriteError.value = (err && err.message) || '收藏加载失败'
    favoriteArticles.value = []
  } finally {
    favoriteLoading.value = false
  }
}

function changeFavoritePage(page) {
  if (page === favoritePage.value) return
  favoritePage.value = page
  loadFavorites()
}

async function cancelFavorite(article) {
  if (cancellingId.value) return
  cancellingId.value = article.id
  try {
    await unfavoriteArticle(article.id)
    toastSuccess('已取消收藏')
    if (favoriteArticles.value.length === 1 && favoritePage.value > 1) {
      favoritePage.value -= 1
    }
    await loadFavorites()
  } catch (err) {
    console.warn('[profile] 取消收藏失败', err)
  } finally {
    cancellingId.value = null
  }
}

function changeTab(key) {
  if (!tabKeys.includes(key) || activeTab.value === key) return
  activeTab.value = key
  router.replace({ query: { ...route.query, tab: key } })
  if (key === 'favorites') loadFavorites()
}

watch(
  () => route.query.tab,
  (value) => {
    if (typeof value !== 'string' || !tabKeys.includes(value)) return
    if (value === activeTab.value) return
    activeTab.value = value
    if (value === 'favorites') loadFavorites()
  }
)

onMounted(() => {
  fillProfile()
  loadProfile()
  loadMyArticles()
  if (activeTab.value === 'favorites') loadFavorites()
})
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
    <header
      class="mb-8 flex flex-col gap-4 border-b-2 border-dashed border-pencil/50 pb-6 md:flex-row md:items-end md:justify-between"
    >
      <div class="flex items-center gap-4">
        <img
          v-if="auth.avatar"
          :src="auth.avatar"
          alt="我的头像"
          class="h-16 w-16 rotate-[-2deg] border-2 border-dashed border-pencil object-cover shadow-sketchsm"
        />
        <span
          v-else
          class="inline-flex h-16 w-16 rotate-[-2deg] items-center justify-center border-2 border-dashed border-pencil font-serif text-2xl italic text-ink-500 shadow-sketchsm"
          aria-hidden="true"
        >
          {{ auth.displayName.slice(0, 1) }}
        </span>
        <div>
          <p class="font-serif text-sm italic text-ink-500">个人中心</p>
          <h1 class="font-serif text-3xl italic text-pencil md:text-4xl">{{ auth.displayName }}</h1>
          <div class="mt-2 flex flex-wrap gap-2">
            <span class="sketch-badge">@{{ auth.user ? auth.user.username : '—' }}</span>
            <span class="sketch-badge border-sketchblue/60 text-sketchblue">
              {{ auth.isAdmin ? 'ADMIN' : 'USER' }}
            </span>
          </div>
        </div>
      </div>
      <p class="font-serif text-xs italic text-ink-300">
        加入于 {{ formatDate(auth.user && auth.user.createTime) }}
      </p>
    </header>

    <div class="flex flex-col gap-6 md:flex-row">
      <nav class="flex flex-wrap gap-2 md:w-48 md:shrink-0 md:flex-col" aria-label="个人中心导航">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          type="button"
          class="inline-flex min-h-[44px] items-center border-2 border-dashed px-4 font-serif text-base italic transition-colors duration-150 active:translate-y-[1px]"
          :class="
            activeTab === tab.key
              ? 'border-pencil bg-pencil text-paper'
              : 'border-pencil/60 text-pencil hover:bg-pencil hover:text-paper'
          "
          :aria-pressed="activeTab === tab.key ? 'true' : 'false'"
          @click="changeTab(tab.key)"
        >
          {{ tab.label }}
        </button>
      </nav>

      <section class="min-w-0 flex-1">
        <!-- 个人资料 -->
        <div v-if="activeTab === 'profile'" class="sketch-card rotate-[-0.2deg] p-6 md:p-8">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="font-serif text-2xl italic text-pencil">个人资料</h2>
            <span v-if="profileLoading" class="font-serif text-xs italic text-ink-300">同步中…</span>
          </div>

          <div class="mt-5 space-y-5">
            <FileUploader
              v-model="profileForm.avatar"
              category="avatar"
              label="头像"
              hint="建议使用正方形图片，上传后记得保存"
              preview-class="max-h-40"
              @uploaded="onAvatarUploaded"
            />
            <SketchInput
              v-model="profileForm.nickname"
              label="昵称"
              placeholder="想被别人怎么称呼"
              :error="profileErrors.nickname"
            />
            <SketchInput
              v-model="profileForm.email"
              label="邮箱"
              type="email"
              placeholder="name@example.com"
              :error="profileErrors.email"
            />
          </div>

          <div class="mt-6 flex flex-wrap gap-3">
            <SketchButton :loading="profileSaving" @click="saveProfile">
              {{ profileSaving ? '保存中…' : '保存资料' }}
            </SketchButton>
            <SketchButton variant="ghost" @click="fillProfile">还原</SketchButton>
          </div>
        </div>

        <!-- 账号安全 -->
        <div v-else-if="activeTab === 'security'" class="sketch-card rotate-[0.2deg] p-6 md:p-8">
          <h2 class="font-serif text-2xl italic text-pencil">修改密码</h2>
          <p class="mt-2 font-serif text-sm italic text-ink-500">
            修改成功后，其他设备的登录状态可能需要重新登录。
          </p>

          <div class="mt-5 max-w-md space-y-4">
            <SketchInput
              v-model="passwordForm.oldPassword"
              label="当前密码"
              type="password"
              autocomplete="current-password"
              :error="passwordErrors.oldPassword"
            />
            <SketchInput
              v-model="passwordForm.newPassword"
              label="新密码"
              type="password"
              placeholder="6-32 位"
              autocomplete="new-password"
              :error="passwordErrors.newPassword"
            />
            <SketchInput
              v-model="passwordForm.confirmPassword"
              label="确认新密码"
              type="password"
              autocomplete="new-password"
              :error="passwordErrors.confirmPassword"
            />
          </div>

          <div class="mt-6">
            <SketchButton :loading="passwordSaving" @click="savePassword">
              {{ passwordSaving ? '提交中…' : '修改密码' }}
            </SketchButton>
          </div>
        </div>

        <!-- 我的收藏 -->
        <div v-else-if="activeTab === 'favorites'" class="sketch-card rotate-[0.2deg] p-6 md:p-8">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="font-serif text-2xl italic text-pencil">我的收藏</h2>
            <span class="font-serif text-xs italic text-ink-300">共 {{ favoriteTotal }} 篇</span>
          </div>

          <div class="sketch-hr"></div>

          <SketchLoading v-if="favoriteLoading" :rows="2" label="正在加载我的收藏" />

          <div
            v-else-if="favoriteError"
            class="flex flex-col items-start gap-3 border-2 border-dashed border-sketchred/60 p-4"
          >
            <p class="font-serif text-sm italic text-sketchred" role="alert">{{ favoriteError }}</p>
            <button type="button" class="sketch-btn min-h-[44px] px-4" @click="loadFavorites">
              重新加载
            </button>
          </div>

          <SketchEmpty
            v-else-if="favoriteArticles.length === 0"
            title="还没有收藏文章"
            description="在文章详情点「收藏」，这里就会留下书签。"
            icon="★"
          >
            <RouterLink :to="{ name: 'home' }" class="sketch-btn min-h-[44px] px-4">
              去逛逛
            </RouterLink>
          </SketchEmpty>

          <div v-else class="space-y-6">
            <div v-for="(article, index) in favoriteArticles" :key="article.id">
              <ArticleCard
                :article="article"
                :class="index % 2 === 0 ? 'rotate-[-0.2deg]' : 'rotate-[0.2deg]'"
              />
              <div class="mt-2 flex flex-wrap items-center justify-between gap-2">
                <p class="font-serif text-xs italic text-ink-300">
                  收藏于 {{ formatDate(article.favoriteTime) }}
                </p>
                <button
                  type="button"
                  class="sketch-btn sketch-btn-danger sketch-btn-sm min-h-[44px] px-3 text-sm"
                  :disabled="cancellingId === article.id"
                  @click="cancelFavorite(article)"
                >
                  {{ cancellingId === article.id ? '取消中…' : '取消收藏' }}
                </button>
              </div>
            </div>

            <SketchPagination
              v-if="favoriteTotal > favoritePageSize"
              :page-num="favoritePage"
              :total="favoriteTotal"
              :page-size="favoritePageSize"
              @update:page-num="changeFavoritePage"
            />
          </div>
        </div>

        <!-- 我的文章 -->
        <div v-else class="sketch-card rotate-[-0.2deg] p-6 md:p-8">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="font-serif text-2xl italic text-pencil">我的文章</h2>
            <div class="flex flex-wrap gap-2" role="group" aria-label="按状态筛选">
              <button
                v-for="option in [
                  { value: '', label: '全部' },
                  { value: '1', label: '已发布' },
                  { value: '0', label: '草稿' }
                ]"
                :key="option.value"
                type="button"
                class="inline-flex min-h-[44px] items-center border-2 border-dashed px-3 font-serif text-sm italic transition-colors"
                :class="
                  myStatus === option.value
                    ? 'border-pencil bg-pencil text-paper'
                    : 'border-pencil/60 text-pencil hover:bg-pencil hover:text-paper'
                "
                :aria-pressed="myStatus === option.value ? 'true' : 'false'"
                @click="changeMyStatus(option.value)"
              >
                {{ option.label }}
              </button>
            </div>
          </div>

          <div class="sketch-hr"></div>

          <SketchLoading v-if="myLoading" :rows="2" label="正在加载我的文章" />

          <div
            v-else-if="myError"
            class="flex flex-col items-start gap-3 border-2 border-dashed border-sketchred/60 p-4"
          >
            <p class="font-serif text-sm italic text-sketchred" role="alert">{{ myError }}</p>
            <button type="button" class="sketch-btn min-h-[44px] px-4" @click="loadMyArticles">
              重新加载
            </button>
          </div>

          <SketchEmpty
            v-else-if="myArticles.length === 0"
            title="这里还没有你的文章"
            description="如果你有管理权限，可以在管理后台写下第一篇。"
            icon="✎"
          >
            <RouterLink
              v-if="auth.isAdmin"
              :to="{ name: 'admin-article-new' }"
              class="sketch-btn min-h-[44px] px-4"
            >
              去写文章
            </RouterLink>
          </SketchEmpty>

          <div v-else class="space-y-4">
            <article
              v-for="article in myArticles"
              :key="article.id"
              class="border-2 border-dashed border-pencil/50 bg-paper p-4"
            >
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="mb-1 flex flex-wrap items-center gap-2">
                    <span
                      class="sketch-badge"
                      :class="
                        article.status === 1
                          ? 'border-sketchgreen/60 text-sketchgreen'
                          : 'border-sketchyellow/60 text-sketchyellow-deep'
                      "
                    >
                      {{ article.status === 1 ? '已发布' : '草稿' }}
                    </span>
                    <span v-if="article.isTop === 1" class="sketch-badge">★ 置顶</span>
                  </div>
                  <RouterLink
                    :to="{ name: 'article', params: { id: article.id } }"
                    class="font-serif text-lg italic text-pencil underline decoration-dashed underline-offset-4 hover:text-ink-900"
                  >
                    {{ article.title }}
                  </RouterLink>
                  <p class="mt-1 font-serif text-xs italic text-ink-300">
                    {{ formatDate(article.createTime) }} · ☕ {{ formatViews(article.viewCount) }} 阅读
                  </p>
                </div>

                <div class="flex flex-wrap gap-2">
                  <RouterLink
                    v-if="auth.isAdmin"
                    :to="{ name: 'admin-article-edit', params: { id: article.id } }"
                    class="sketch-btn sketch-btn-sm min-h-[44px] px-3 text-sm"
                  >
                    编辑
                  </RouterLink>
                  <button
                    type="button"
                    class="sketch-btn sketch-btn-danger sketch-btn-sm min-h-[44px] px-3 text-sm"
                    @click="askDelete(article)"
                  >
                    删除
                  </button>
                </div>
              </div>
            </article>

            <SketchPagination
              v-if="myTotal > myPageSize"
              :page-num="myPage"
              :total="myTotal"
              :page-size="myPageSize"
              @update:page-num="changeMyPage"
            />
          </div>
        </div>
      </section>
    </div>

    <SketchModal
      :model-value="Boolean(deleteTarget)"
      title="删除文章"
      @update:model-value="deleteTarget = null"
    >
      <p class="font-serif text-sm leading-relaxed text-ink-700">
        确定要删除《{{ deleteTarget ? deleteTarget.title : '' }}》吗？删除后列表中不再可见。
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
