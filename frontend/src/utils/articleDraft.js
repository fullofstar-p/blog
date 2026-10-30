/**
 * 文章本地草稿：存 localStorage，按文章 ID（新文章为 new）分键。
 *
 * 只负责读写与容错，自动保存的节奏由 AdminArticleEdit.vue 控制。
 * 草稿内容与后端 ArticleSaveDTO 对齐，另外附带 articleId / savedAt。
 */
const KEY_PREFIX = 'blog:article-draft:'

function keyOf(articleId) {
  return `${KEY_PREFIX}${articleId || 'new'}`
}

/** 读取草稿；JSON 损坏或字段不合法时静默丢弃 */
export function readDraft(articleId) {
  try {
    const raw = localStorage.getItem(keyOf(articleId))
    if (!raw) return null
    const draft = JSON.parse(raw)
    if (!draft || typeof draft !== 'object' || typeof draft.savedAt !== 'number') return null
    return {
      articleId: draft.articleId ? String(draft.articleId) : '',
      savedAt: draft.savedAt,
      title: typeof draft.title === 'string' ? draft.title : '',
      summary: typeof draft.summary === 'string' ? draft.summary : '',
      content: typeof draft.content === 'string' ? draft.content : '',
      cover: typeof draft.cover === 'string' ? draft.cover : '',
      categoryId: draft.categoryId ?? '',
      tagIds: Array.isArray(draft.tagIds) ? draft.tagIds.filter((id) => Number.isInteger(id)) : [],
      status: draft.status === 1 ? 1 : 0,
      isTop: draft.isTop === 1 ? 1 : 0
    }
  } catch (error) {
    console.warn('[draft] 读取本地草稿失败', error)
    return null
  }
}

/** 写入草稿；localStorage 满或被禁用时返回 false，不阻塞编辑 */
export function writeDraft(articleId, draft) {
  try {
    localStorage.setItem(keyOf(articleId), JSON.stringify(draft))
    return true
  } catch (error) {
    console.warn('[draft] 写入本地草稿失败', error)
    return false
  }
}

export function removeDraft(articleId) {
  try {
    localStorage.removeItem(keyOf(articleId))
  } catch (error) {
    console.warn('[draft] 删除本地草稿失败', error)
  }
}

/** 草稿时间：HH:mm:ss */
export function formatDraftTime(timestamp) {
  if (!timestamp) return '—'
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleTimeString('zh-CN', { hour12: false })
}
