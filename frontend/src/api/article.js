import request from './request'

/** 文章模块 /api/articles */

export function listArticles(params) {
  return request.get('/articles', { params })
}

export function getTopArticles(limit = 5) {
  return request.get('/articles/top', { params: { limit } })
}

export function getArticle(id) {
  return request.get(`/articles/${id}`)
}

export function getArchive() {
  return request.get('/articles/archive')
}

export function getMyArticles(params) {
  return request.get('/articles/mine', { params })
}

export function createArticle(data) {
  return request.post('/articles', data)
}

export function updateArticle(id, data) {
  return request.put(`/articles/${id}`, data)
}

export function deleteArticle(id) {
  return request.delete(`/articles/${id}`)
}

// ---------- P1-2 点赞 / 收藏 ----------

/** 互动状态（公开）：{ liked, favorited, likeCount, favoriteCount } */
export function getArticleInteraction(id) {
  // 互动状态属于增强信息，失败时静默降级为详情里的计数字段，不弹错误提示
  return request.get(`/articles/${id}/interaction`, { silent: true })
}

export function likeArticle(id) {
  return request.post(`/articles/${id}/like`)
}

export function unlikeArticle(id) {
  return request.delete(`/articles/${id}/like`)
}

export function favoriteArticle(id) {
  return request.post(`/articles/${id}/favorite`)
}

export function unfavoriteArticle(id) {
  return request.delete(`/articles/${id}/favorite`)
}

/** 我的收藏（登录）：PageResult<ArticleSummaryVO>，按收藏时间倒序 */
export function getMyFavorites(params) {
  return request.get('/favorites', { params })
}

// ---------- P1-5 相关文章 / P1-4 分享卡片 ----------

/** 相关文章（公开）：ArticleSummaryVO[] */
export function getRelatedArticles(id, limit = 6) {
  return request.get(`/articles/${id}/related`, { params: { limit }, silent: true })
}

/** 分享卡片 PNG 地址（公开，直接作为 <img> 来源，无需 axios） */
export function getShareCardUrl(id) {
  return `/api/articles/${id}/share-card.png`
}
