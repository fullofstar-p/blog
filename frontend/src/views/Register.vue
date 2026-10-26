<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import SketchButton from '@/components/SketchButton.vue'
import SketchInput from '@/components/SketchInput.vue'
import { useAuthStore } from '@/store/auth'
import { toastSuccess } from '@/utils/toast'

const auth = useAuthStore()
const router = useRouter()

const form = reactive({
  username: '',
  nickname: '',
  email: '',
  password: '',
  confirmPassword: ''
})
const errors = reactive({
  username: '',
  nickname: '',
  email: '',
  password: '',
  confirmPassword: ''
})
const submitError = ref('')
const submitting = ref(false)

function validate() {
  const username = form.username.trim()
  errors.username = /^[A-Za-z0-9_]{4,20}$/.test(username)
    ? ''
    : '用户名为 4-20 位字母、数字或下划线'
  errors.nickname = form.nickname.length > 50 ? '昵称不能超过 50 个字符' : ''
  const email = form.email.trim()
  errors.email = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '邮箱格式不正确' : ''
  errors.password =
    form.password.length >= 6 && form.password.length <= 32 ? '' : '密码需为 6-32 位'
  errors.confirmPassword = form.confirmPassword === form.password ? '' : '两次输入的密码不一致'
  return Object.values(errors).every((item) => !item)
}

async function onSubmit() {
  submitError.value = ''
  if (!validate()) return
  submitting.value = true
  try {
    await auth.registerUser({
      username: form.username.trim(),
      password: form.password,
      nickname: form.nickname.trim() || undefined,
      email: form.email.trim() || undefined
    })
    toastSuccess('注册成功，请登录')
    router.push({ name: 'login', query: { username: form.username.trim() } })
  } catch (err) {
    submitError.value = (err && err.message) || '注册失败，请稍后再试'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl px-4 py-16 md:px-6 md:py-24">
    <div class="mx-auto max-w-md">
      <header class="mb-8 text-center">
        <p class="font-serif text-sm italic text-ink-500">新的一页</p>
        <h1 class="mt-2 font-serif text-3xl italic text-pencil md:text-4xl">在笔记本上留下名字</h1>
      </header>

      <form class="sketch-card rotate-[0.3deg] p-6 md:p-8" @submit.prevent="onSubmit" novalidate>
        <div class="space-y-4">
          <SketchInput
            v-model="form.username"
            label="用户名"
            placeholder="4-20 位字母、数字或下划线"
            autocomplete="username"
            required
            :error="errors.username"
          />
          <SketchInput
            v-model="form.nickname"
            label="昵称（可选）"
            placeholder="想被别人怎么称呼"
            autocomplete="nickname"
            :error="errors.nickname"
          />
          <SketchInput
            v-model="form.email"
            label="邮箱（可选）"
            type="email"
            placeholder="name@example.com"
            autocomplete="email"
            :error="errors.email"
          />
          <SketchInput
            v-model="form.password"
            label="密码"
            type="password"
            placeholder="6-32 位密码"
            autocomplete="new-password"
            required
            :error="errors.password"
          />
          <SketchInput
            v-model="form.confirmPassword"
            label="确认密码"
            type="password"
            placeholder="再输入一次密码"
            autocomplete="new-password"
            required
            :error="errors.confirmPassword"
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
          {{ submitting ? '注册中…' : '注册' }}
        </SketchButton>

        <p class="mt-5 text-center font-serif text-sm italic text-ink-500">
          已经有账号？
          <RouterLink :to="{ name: 'login' }" class="sketch-link">去登录</RouterLink>
        </p>
      </form>
    </div>
  </div>
</template>
