<script setup>
import { onMounted, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SketchButton from '@/components/SketchButton.vue'
import SketchInput from '@/components/SketchInput.vue'
import { useAuthStore } from '@/store/auth'
import { toastSuccess } from '@/utils/toast'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

const form = reactive({ username: '', password: '' })
const errors = reactive({ username: '', password: '' })
const submitError = ref('')
const submitting = ref(false)

function validate() {
  errors.username = form.username.trim() ? '' : '请输入用户名'
  errors.password = form.password ? '' : '请输入密码'
  return !errors.username && !errors.password
}

async function onSubmit() {
  submitError.value = ''
  if (!validate()) return
  submitting.value = true
  try {
    await auth.login({ username: form.username.trim(), password: form.password })
    toastSuccess('登录成功，欢迎回来')
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    if (redirect && redirect.startsWith('/')) router.replace(redirect)
    else router.replace({ name: 'home' })
  } catch (err) {
    submitError.value = (err && err.message) || '登录失败，请检查用户名与密码'
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  if (typeof route.query.username === 'string') form.username = route.query.username
})
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
    <div class="mx-auto max-w-md">
      <header class="mb-8 text-center">
        <p class="font-serif text-sm italic text-ink-500">欢迎回来</p>
        <h1 class="mt-2 font-serif text-3xl italic text-pencil md:text-4xl">翻到上次的页码</h1>
      </header>

      <form class="sketch-card rotate-[-0.3deg] p-6 md:p-8" @submit.prevent="onSubmit" novalidate>
        <div class="space-y-4">
          <SketchInput
            v-model="form.username"
            label="用户名"
            placeholder="请输入用户名"
            autocomplete="username"
            required
            :error="errors.username"
          />
          <SketchInput
            v-model="form.password"
            label="密码"
            type="password"
            placeholder="请输入密码"
            autocomplete="current-password"
            required
            :error="errors.password"
          />
        </div>

        <p
          v-if="submitError"
          class="mt-4 border-l-2 border-dashed border-[#b23b2e] pl-3 font-serif text-sm italic text-[#b23b2e]"
          role="alert"
        >
          {{ submitError }}
        </p>

        <SketchButton type="submit" block class="mt-6" :loading="submitting">
          {{ submitting ? '登录中…' : '登录' }}
        </SketchButton>

        <p class="mt-5 text-center font-serif text-sm italic text-ink-500">
          还没有账号？
          <RouterLink :to="{ name: 'register' }" class="sketch-link">去注册</RouterLink>
        </p>
      </form>

      <p class="mt-6 text-center font-serif text-xs leading-relaxed italic text-ink-300">
        管理员账号在部署时由环境变量初始化；普通读者注册后即可评论与点赞。
      </p>
    </div>
  </div>
</template>
