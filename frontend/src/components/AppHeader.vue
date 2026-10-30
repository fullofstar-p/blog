<script setup>
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import ThemeToggle from '@/components/ThemeToggle.vue'
import { useAuthStore } from '@/store/auth'
import { toastSuccess } from '@/utils/toast'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const mobileOpen = ref(false)
const userMenuOpen = ref(false)
const keyword = ref('')
const userMenuRef = ref(null)

const navLinks = [
  { name: 'home', label: '首页' },
  { name: 'archive', label: '归档' },
  { name: 'about', label: '关于' }
]

function submitSearch(event) {
  event.preventDefault()
  const value = keyword.value.trim()
  if (!value) return
  mobileOpen.value = false
  router.push({ name: 'search', query: { keyword: value } })
}

async function onLogout() {
  userMenuOpen.value = false
  await auth.logout()
  toastSuccess('已退出登录，欢迎再来')
  router.push({ name: 'home' })
}

function onDocumentClick(event) {
  if (userMenuRef.value && !userMenuRef.value.contains(event.target)) {
    userMenuOpen.value = false
  }
}

watch(
  () => route.fullPath,
  () => {
    mobileOpen.value = false
    userMenuOpen.value = false
  }
)

watch(
  () => route.query.keyword,
  (value) => {
    keyword.value = typeof value === 'string' ? value : ''
  },
  { immediate: true }
)

onMounted(() => document.addEventListener('click', onDocumentClick))
onUnmounted(() => document.removeEventListener('click', onDocumentClick))
</script>

<template>
  <header class="sticky top-0 z-30 border-b-2 border-dashed border-pencil bg-paper/95">
    <div class="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 md:px-6">
      <RouterLink
        :to="{ name: 'home' }"
        class="group flex min-h-[44px] items-center gap-2 font-serif text-xl italic text-pencil"
      >
        <span
          class="inline-flex h-9 w-9 rotate-[-3deg] items-center justify-center border-2 border-dashed border-pencil text-base shadow-sketchsm transition-transform duration-150 group-hover:-rotate-6"
          aria-hidden="true"
        >
          ✎
        </span>
        <span class="sketch-wavy">技术分享博客</span>
      </RouterLink>

      <nav class="hidden items-center gap-2 md:flex" aria-label="主导航">
        <RouterLink
          v-for="link in navLinks"
          :key="link.name"
          :to="{ name: link.name }"
          class="inline-flex min-h-[44px] items-center border-b-2 border-dashed border-transparent px-3 font-serif text-base italic text-ink-700 transition-all duration-150 hover:border-pencil hover:bg-pencil hover:text-paper active:translate-y-[1px]"
          active-class="border-pencil bg-pencil text-paper rotate-[-1deg]"
        >
          {{ link.label }}
        </RouterLink>
      </nav>

      <form class="hidden items-center gap-2 lg:flex" role="search" @submit="submitSearch">
        <label for="header-search" class="sr-only">搜索文章</label>
        <input
          id="header-search"
          v-model="keyword"
          type="search"
          placeholder="搜点什么…"
          class="sketch-input h-11 min-h-[44px] w-44 px-3 text-sm"
        />
        <button type="submit" class="sketch-btn sketch-btn-sm min-h-[44px] px-3" aria-label="提交搜索">
          搜索
        </button>
      </form>

      <div class="flex items-center gap-2">
        <ThemeToggle />

        <template v-if="auth.isLoggedIn">
          <div ref="userMenuRef" class="relative">
            <button
              type="button"
              class="inline-flex min-h-[44px] items-center gap-2 border-2 border-dashed border-pencil bg-paper px-2 py-1 font-serif text-sm italic text-pencil shadow-sketchsm transition-all duration-150 hover:bg-pencil hover:text-paper active:translate-x-[1px] active:translate-y-[1px]"
              :aria-expanded="userMenuOpen ? 'true' : 'false'"
              aria-haspopup="menu"
              @click="userMenuOpen = !userMenuOpen"
            >
              <img
                v-if="auth.avatar"
                :src="auth.avatar"
                alt=""
                class="h-7 w-7 border border-dashed border-current object-cover"
              />
              <span
                v-else
                class="inline-flex h-7 w-7 items-center justify-center border border-dashed border-current text-xs"
                aria-hidden="true"
              >
                {{ auth.displayName.slice(0, 1) }}
              </span>
              <span class="hidden max-w-[7rem] truncate sm:inline">{{ auth.displayName }}</span>
              <span aria-hidden="true">▾</span>
            </button>

            <div
              v-if="userMenuOpen"
              role="menu"
              class="absolute right-0 top-[calc(100%+8px)] z-40 w-48 rotate-[0.4deg] border-2 border-dashed border-pencil bg-paper p-2 shadow-sketch-lg"
            >
              <RouterLink
                :to="{ name: 'profile' }"
                role="menuitem"
                class="flex min-h-[44px] items-center px-3 font-serif text-sm italic text-pencil transition-colors hover:bg-pencil hover:text-paper"
              >
                个人中心
              </RouterLink>
              <RouterLink
                v-if="auth.isAdmin"
                :to="{ name: 'admin-articles' }"
                role="menuitem"
                class="flex min-h-[44px] items-center px-3 font-serif text-sm italic text-pencil transition-colors hover:bg-pencil hover:text-paper"
              >
                管理后台
              </RouterLink>
              <button
                type="button"
                role="menuitem"
                class="flex min-h-[44px] w-full items-center px-3 text-left font-serif text-sm italic text-sketchred transition-colors hover:bg-sketchred hover:text-paper"
                @click="onLogout"
              >
                退出登录
              </button>
            </div>
          </div>
        </template>
        <template v-else>
          <RouterLink
            :to="{ name: 'login' }"
            class="hidden min-h-[44px] items-center border-2 border-dashed border-pencil px-3 font-serif text-sm italic text-pencil shadow-sketchsm transition-all duration-150 hover:bg-pencil hover:text-paper sm:inline-flex"
          >
            登录
          </RouterLink>
          <RouterLink
            :to="{ name: 'register' }"
            class="hidden min-h-[44px] items-center border-2 border-dashed border-pencil bg-pencil px-3 font-serif text-sm italic text-paper shadow-sketchsm transition-all duration-150 hover:bg-paper hover:text-pencil sm:inline-flex"
          >
            注册
          </RouterLink>
        </template>

        <button
          type="button"
          class="inline-flex h-11 w-11 items-center justify-center border-2 border-dashed border-pencil text-pencil transition-colors duration-150 hover:bg-pencil hover:text-paper active:translate-y-[1px] md:hidden"
          :aria-expanded="mobileOpen ? 'true' : 'false'"
          aria-controls="mobile-menu"
          aria-label="打开导航菜单"
          @click="mobileOpen = !mobileOpen"
        >
          {{ mobileOpen ? '✕' : '☰' }}
        </button>
      </div>
    </div>

    <div v-if="mobileOpen" id="mobile-menu" class="border-t border-dashed border-pencil/50 bg-paper px-4 pb-4 md:hidden">
      <nav class="flex flex-col gap-2 pt-3" aria-label="移动端导航">
        <RouterLink
          v-for="link in navLinks"
          :key="link.name"
          :to="{ name: link.name }"
          class="flex min-h-[44px] items-center border-2 border-dashed border-pencil/60 px-3 font-serif text-base italic text-pencil"
          active-class="bg-pencil text-paper"
        >
          {{ link.label }}
        </RouterLink>

        <form class="mt-2 flex gap-2" role="search" @submit="submitSearch">
          <label for="mobile-search" class="sr-only">搜索文章</label>
          <input
            id="mobile-search"
            v-model="keyword"
            type="search"
            placeholder="搜点什么…"
            class="sketch-input min-h-[44px] flex-1 px-3 text-sm"
          />
          <button type="submit" class="sketch-btn sketch-btn-sm min-h-[44px] px-3">搜索</button>
        </form>

        <div v-if="!auth.isLoggedIn" class="mt-2 flex gap-2">
          <RouterLink
            :to="{ name: 'login' }"
            class="flex min-h-[44px] flex-1 items-center justify-center border-2 border-dashed border-pencil font-serif text-sm italic"
          >
            登录
          </RouterLink>
          <RouterLink
            :to="{ name: 'register' }"
            class="flex min-h-[44px] flex-1 items-center justify-center border-2 border-dashed border-pencil bg-pencil font-serif text-sm italic text-paper"
          >
            注册
          </RouterLink>
        </div>
      </nav>
    </div>
  </header>
</template>
