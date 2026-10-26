/** 通用格式化工具 */

/** 阅读量：1000 → 1k / 1234 → 1.2k */
export function formatViews(value) {
  const count = Number(value) || 0
  if (count < 1000) return String(count)
  const k = count / 1000
  return `${k >= 10 ? Math.round(k) : k.toFixed(1)}k`
}

/** 后端时间格式 yyyy-MM-dd HH:mm:ss，这里保留到分钟 */
export function formatDate(value) {
  if (!value) return '—'
  const text = String(value)
  return text.length > 16 ? text.slice(0, 16) : text
}

/** 只显示日期部分 */
export function formatDay(value) {
  if (!value) return '—'
  return String(value).slice(0, 10)
}

/** 相对时间：用于评论列表 */
export function timeAgo(value) {
  if (!value) return '—'
  const time = new Date(String(value).replace(/-/g, '/')).getTime()
  if (Number.isNaN(time)) return formatDate(value)
  const diff = Date.now() - time
  const minute = 60 * 1000
  if (diff < minute) return '刚刚'
  if (diff < 60 * minute) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))} 小时前`
  if (diff < 30 * 24 * 60 * minute) return `${Math.floor(diff / (24 * 60 * minute))} 天前`
  return formatDay(value)
}

/** 纯文本摘要（去掉 Markdown 标记） */
export function plainText(text, max = 120) {
  const cleaned = String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (cleaned.length <= max) return cleaned
  return `${cleaned.slice(0, max)}…`
}

/** 文件大小 */
export function formatSize(bytes) {
  const size = Number(bytes) || 0
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / 1024 / 1024).toFixed(1)} MB`
}
