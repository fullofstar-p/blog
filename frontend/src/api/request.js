import axios from 'axios'
import { useAuthStore } from '@/store/auth'
import { pushToast } from '@/utils/toast'

/**
 * Axios 统一封装：
 * 1) 请求拦截注入 Bearer Token；
 * 2) 响应拦截按 { code, message, data } 解包，code !== 200 统一抛错；
 * 3) HTTP 401 / 业务码 401：清理登录态并跳转登录页；
 * 4) 网络异常统一提示；单次请求可通过 config.silent = true 关闭自动提示。
 */
const service = axios.create({
  baseURL: '/api',
  timeout: 20000
})

let redirecting = false

async function redirectToLogin() {
  if (redirecting) return
  redirecting = true
  try {
    const { default: router } = await import('@/router')
    const current = router.currentRoute.value
    if (current.name !== 'login') {
      await router.replace({ name: 'login', query: { redirect: current.fullPath } })
    }
  } catch (error) {
    console.warn('[request] 跳转登录页失败', error)
  } finally {
    setTimeout(() => {
      redirecting = false
    }, 800)
  }
}

function handleUnauthorized() {
  try {
    useAuthStore().clearSession()
  } catch (error) {
    console.warn('[request] 清理登录态失败', error)
  }
  pushToast('登录状态已失效，请重新登录', 'error')
  redirectToLogin()
}

service.interceptors.request.use((config) => {
  try {
    const token = useAuthStore().accessToken
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
  } catch (error) {
    console.warn('[request] 注入 Token 失败', error)
  }
  return config
})

service.interceptors.response.use(
  (response) => {
    const payload = response.data
    // 非统一返回体（例如 Blob）直接透传
    if (!payload || typeof payload !== 'object' || typeof payload.code === 'undefined') {
      return payload
    }
    if (payload.code === 200) return payload.data

    const error = new Error(payload.message || '请求失败')
    error.code = payload.code
    if (payload.code === 401) {
      handleUnauthorized()
    } else if (!(response.config && response.config.silent)) {
      pushToast(error.message, 'error')
    }
    return Promise.reject(error)
  },
  (error) => {
    const status = error.response && error.response.status
    const body = error.response && error.response.data
    const message =
      (body && body.message) ||
      (status === 401 ? '登录状态已失效，请重新登录' : error.message) ||
      '网络异常，请稍后重试'

    if (status === 401) {
      handleUnauthorized()
    } else if (!(error.config && error.config.silent)) {
      pushToast(message, 'error')
    }

    const wrapped = new Error(message)
    wrapped.code = status || 0
    wrapped.cause = error
    return Promise.reject(wrapped)
  }
)

export default service
