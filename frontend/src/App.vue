<script setup>
import { onMounted } from 'vue'
import AppHeader from '@/components/AppHeader.vue'
import AppFooter from '@/components/AppFooter.vue'
import AppToast from '@/components/AppToast.vue'
import { useAuthStore } from '@/store/auth'

const auth = useAuthStore()

// 已有 Token 但本地没有用户信息时，静默补拉一次
onMounted(async () => {
  if (!auth.isLoggedIn || auth.user) return
  try {
    await auth.loadMe()
  } catch (error) {
    console.warn('[app] 恢复登录态失败', error)
    auth.clearSession()
  }
})
</script>

<template>
  <div class="flex min-h-screen flex-col bg-paper text-pencil">
    <a
      href="#main-content"
      class="sr-only min-h-[44px] items-center border-2 border-dashed border-pencil bg-paper px-4 focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:inline-flex"
    >
      跳到主要内容
    </a>

    <AppHeader />

    <main id="main-content" class="flex-1">
      <RouterView v-slot="{ Component }">
        <component :is="Component" />
      </RouterView>
    </main>

    <AppFooter />
    <AppToast />
  </div>
</template>
