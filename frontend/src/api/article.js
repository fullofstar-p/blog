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
