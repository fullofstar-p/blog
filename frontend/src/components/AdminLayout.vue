<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/store/auth'
import { toastSuccess } from '@/utils/toast'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const menuOpen = ref(false)

const navItems = [
  { name: 'admin-dashboard', label: '内容看板', icon: '▤' },
  { name: 'admin-articles', label: '文章管理', icon: '✎' },
  { name: 'admin-recycle', label: '回收站', icon: '♻' },
  { name: 'admin-comments', label: '评论审核', icon: '✉' },
  { name: 'admin-categories', label: '分类管理', icon: '◈' },
  { name: 'admin-tags', label: '标签管理', icon: '#' },
  { name: 'admin-users', label: '用户管理', icon: '☺' }
]

const currentTitle = computed(() => (route.meta && route.meta.title) || '管理后台')

async function onLogout() {
  await auth.logout()
  toastSuccess('已退出登录')
  router.push({ name: 'home' })
}
</script>

<template>
  <div class="min-h-[70vh]">
    <div
      class="mb-6 flex flex-wrap items-center justify-between gap-3 border-b-2 border-dashed border-pencil pb-4"
    >
      <div class="flex flex-wrap items-center gap-3">
        <RouterLink
          :to="{ name: 'home' }"
          class="inline-flex min-h-[44px] items-center border-2 border-dashed border-pencil/60 px-3 font-serif text-sm italic text-pencil transition-colors hover:bg-pencil hover:text-paper"
        >
          ← 返回前台
        </RouterLink>
        <h1 class="font-serif text-2xl italic text-pencil md:text-3xl">管理后台</h1>
        <span class="sketch-badge">{{ currentTitle }}</span>
      </div>

      <div class="flex items-center gap-2">
        <span class="hidden font-serif text-sm italic text-ink-500 sm:inline">
          {{ auth.displayName }}
        </span>
        <button
          type="button"
          class="sketch-btn sketch-btn-sm min-h-[44px] px-3 text-sm"
          @click="onLogout"
        >
          退出登录
        </button>
        <button
          type="button"
          class="inline-flex h-11 w-11 items-center justify-center border-2 border-dashed border-pencil text-pencil transition-colors hover:bg-pencil hover:text-paper md:hidden"
          :aria-expanded="menuOpen ? 'true' : 'false'"
          aria-controls="admin-mobile-nav"
          aria-label="展开管理导航"
          @click="menuOpen = !menuOpen"
        >
          {{ menuOpen ? '✕' : '☰' }}
        </button>
      </div>
    </div>

    <div class="flex flex-col gap-6 md:flex-row">
      <aside class="md:w-52 md:shrink-0">
        <nav
          id="admin-mobile-nav"
          class="flex flex-col gap-2"
          :class="menuOpen ? 'flex' : 'hidden md:flex'"
          aria-label="管理导航"
        >
          <RouterLink
            v-for="item in navItems"
            :key="item.name"
            :to="{ name: item.name }"
            class="flex min-h-[44px] items-center gap-2 border-2 border-dashed border-pencil/60 px-3 font-serif text-base italic text-pencil transition-all duration-150 hover:-rotate-1 hover:bg-pencil hover:text-paper active:translate-y-[1px]"
            active-class="border-pencil bg-pencil !text-paper"
          >
            <span aria-hidden="true">{{ item.icon }}</span>
            {{ item.label }}
          </RouterLink>
        </nav>
      </aside>

      <section class="min-w-0 flex-1">
        <RouterView />
      </section>
    </div>
  </div>
</template>
