import { reactive } from 'vue'

/**
 * 轻量全局提示（Toast）。
 * 不依赖 Pinia，避免 Axios 拦截器与 store 之间产生循环依赖。
 */
export const toastState = reactive({ items: [] })

let seed = 0
const timers = new Map()

export function dismissToast(id) {
  const index = toastState.items.findIndex((item) => item.id === id)
  if (index >= 0) toastState.items.splice(index, 1)
  const timer = timers.get(id)
  if (timer) {
    clearTimeout(timer)
    timers.delete(id)
  }
}

export function pushToast(message, type = 'info') {
  const text = String(message || '').trim()
  if (!text) return 0
  const id = ++seed
  toastState.items.push({ id, message: text, type })
  const timer = setTimeout(() => dismissToast(id), type === 'error' ? 4200 : 3000)
  timers.set(id, timer)
  return id
}

export const toastSuccess = (message) => pushToast(message, 'success')
export const toastError = (message) => pushToast(message, 'error')
