import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import * as authApi from '@/api/auth'
import * as userApi from '@/api/user'

const ACCESS_TOKEN_KEY = 'blog.accessToken'
const REFRESH_TOKEN_KEY = 'blog.refreshToken'
const USER_KEY = 'blog.user'

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    console.warn('[auth] 读取本地用户信息失败', error)
    return null
  }
}

/**
 * 登录态 store：token 持久化到 localStorage，刷新页面后自动恢复。
 */
export const useAuthStore = defineStore('auth', () => {
  const accessToken = ref(localStorage.getItem(ACCESS_TOKEN_KEY) || '')
  const refreshToken = ref(localStorage.getItem(REFRESH_TOKEN_KEY) || '')
  const user = ref(readStoredUser())
  const loginLoading = ref(false)

  const isLoggedIn = computed(() => Boolean(accessToken.value))
  const isAdmin = computed(() => Boolean(user.value && user.value.role === 'ADMIN'))
  const displayName = computed(() => {
    if (!user.value) return '访客'
    return user.value.nickname || user.value.username || '访客'
  })
  const avatar = computed(() => (user.value && user.value.avatar) || '')

  function persistTokens() {
    if (accessToken.value) localStorage.setItem(ACCESS_TOKEN_KEY, accessToken.value)
    else localStorage.removeItem(ACCESS_TOKEN_KEY)
    if (refreshToken.value) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken.value)
    else localStorage.removeItem(REFRESH_TOKEN_KEY)
  }

  function persistUser() {
    if (user.value) localStorage.setItem(USER_KEY, JSON.stringify(user.value))
    else localStorage.removeItem(USER_KEY)
  }

  function setSession(data) {
    accessToken.value = (data && data.accessToken) || ''
    refreshToken.value = (data && data.refreshToken) || ''
    user.value = (data && data.user) || null
    persistTokens()
    persistUser()
  }

  function clearSession() {
    accessToken.value = ''
    refreshToken.value = ''
    user.value = null
    localStorage.removeItem(ACCESS_TOKEN_KEY)
    localStorage.removeItem(REFRESH_TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
  }

  async function login(payload) {
    loginLoading.value = true
    try {
      const data = await authApi.login(payload)
      setSession(data)
      return data
    } finally {
      loginLoading.value = false
    }
  }

  async function registerUser(payload) {
    return authApi.register(payload)
  }

  async function loadMe() {
    const data = await userApi.getMe()
    user.value = data
    persistUser()
    return data
  }

  async function refreshSession() {
    if (!refreshToken.value) {
      const error = new Error('缺少刷新令牌')
      error.code = 401
      throw error
    }
    const data = await authApi.refresh(refreshToken.value)
    setSession(data)
    return data
  }

  async function updateProfile(payload) {
    const data = await userApi.updateMe(payload)
    user.value = data
    persistUser()
    return data
  }

  async function updatePassword(payload) {
    return userApi.changePassword(payload)
  }

  async function logout() {
    try {
      await authApi.logout({ refreshToken: refreshToken.value })
    } catch (error) {
      // 登出失败不阻塞前端清理，Token 过期时后端也会拒绝
      console.warn('[auth] 注销请求失败', error)
    } finally {
      clearSession()
    }
  }

  return {
    accessToken,
    refreshToken,
    user,
    loginLoading,
    isLoggedIn,
    isAdmin,
    displayName,
    avatar,
    setSession,
    clearSession,
    login,
    registerUser,
    loadMe,
    refreshSession,
    updateProfile,
    updatePassword,
    logout
  }
})
