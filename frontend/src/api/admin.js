import request from './request'

/** 管理端 /api/admin：文章、评论审核、分类、标签、用户 */

// ---------- 文章 ----------
export function listAdminArticles(params) {
  return request.get('/admin/articles', { params })
}

export function updateArticleTop(id, isTop) {
  return request.put(`/admin/articles/${id}/top`, { isTop })
}

export function deleteAdminArticle(id) {
  return request.delete(`/admin/articles/${id}`)
}

export function listRecycleArticles(params) {
  return request.get('/admin/articles/recycle', { params })
}

export function restoreAdminArticle(id) {
  return request.put(`/admin/articles/${id}/restore`)
}

export function purgeAdminArticle(id) {
  return request.delete(`/admin/articles/${id}/purge`)
}

// ---------- 评论审核 ----------
export function listAdminComments(params) {
  return request.get('/admin/comments', { params })
}

export function auditComment(id, status) {
  return request.put(`/admin/comments/${id}/audit`, { status })
}

export function deleteAdminComment(id) {
  return request.delete(`/admin/comments/${id}`)
}

// ---------- 分类 ----------
export function createCategory(data) {
  return request.post('/admin/categories', data)
}

export function updateCategory(id, data) {
  return request.put(`/admin/categories/${id}`, data)
}

export function deleteCategory(id) {
  return request.delete(`/admin/categories/${id}`)
}

// ---------- 标签 ----------
export function createTag(data) {
  return request.post('/admin/tags', data)
}

export function updateTag(id, data) {
  return request.put(`/admin/tags/${id}`, data)
}

export function deleteTag(id) {
  return request.delete(`/admin/tags/${id}`)
}

// ---------- 用户 ----------
export function listAdminUsers(params) {
  return request.get('/admin/users', { params })
}

export function updateUserStatus(id, status) {
  return request.put(`/admin/users/${id}/status`, { status })
}

export function updateUserRole(id, role) {
  return request.put(`/admin/users/${id}/role`, { role })
}
