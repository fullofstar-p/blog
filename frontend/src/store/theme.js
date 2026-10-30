import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'

const STORAGE_KEY = 'blog.theme'
const MODES = ['system', 'light', 'dark']
const MODE_LABELS = { system: '跟随系统', light: '浅色', dark: '深色' }
const THEME_COLORS = { light: '#f5f0e8', dark: '#1b1a17' }

const mediaQuery =
  typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

let mediaBound = false
let storageBound = false

function readMode() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return MODES.includes(stored) ? stored : 'system'
  } catch (error) {
    console.warn('[theme] 读取主题设置失败', error)
    return 'system'
  }
}

/**
 * 主题：system / light / dark。
 *
 * - `system` 跟随 prefers-color-scheme，系统切换时实时生效；
 * - 手动选择会写入 localStorage（首次渲染前由 index.html 的内联脚本读出，避免闪白）；
 * - 真实主题挂在 <html class="dark"> 上，所有颜色来自 styles/main.css 的 CSS 变量。
 */
export const useThemeStore = defineStore('theme', () => {
  const mode = ref(readMode())
  const systemDark = ref(Boolean(mediaQuery && mediaQuery.matches))

  const resolved = computed(() => {
    if (mode.value === 'system') return systemDark.value ? 'dark' : 'light'
    return mode.value
  })
  const isDark = computed(() => resolved.value === 'dark')
  const modeLabel = computed(() => MODE_LABELS[mode.value] || MODE_LABELS.system)
  const label = computed(() =>
    mode.value === 'system' ? `跟随系统（当前${isDark.value ? '深色' : '浅色'}）` : modeLabel.value
  )

  function applyToDom() {
    if (typeof document === 'undefined') return
    const dark = isDark.value
    const root = document.documentElement
    root.classList.toggle('dark', dark)
    root.style.colorScheme = dark ? 'dark' : 'light'
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', dark ? THEME_COLORS.dark : THEME_COLORS.light)
  }

  function setMode(next) {
    if (!MODES.includes(next)) return
    mode.value = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch (error) {
      console.warn('[theme] 保存主题设置失败', error)
    }
    applyToDom()
  }

  function cycle() {
    const index = MODES.indexOf(mode.value)
    setMode(MODES[(index + 1) % MODES.length])
  }

  function init() {
    if (mediaQuery && !mediaBound) {
      mediaQuery.addEventListener('change', (event) => {
        systemDark.value = event.matches
      })
      mediaBound = true
    }
    if (typeof window !== 'undefined' && !storageBound) {
      window.addEventListener('storage', (event) => {
        if (event.key === STORAGE_KEY && MODES.includes(event.newValue)) {
          mode.value = event.newValue
        }
      })
      storageBound = true
    }
    applyToDom()
  }

  watch(resolved, applyToDom)

  return {
    mode,
    resolved,
    isDark,
    label,
    modeLabel,
    setMode,
    cycle,
    init
  }
})
