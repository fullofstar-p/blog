import request from './request'

/** 评论模块 */

export function listComments(articleId) {
  return request.get(`/articles/${articleId}/comments`)
}

export function createComment(data) {
  return request.post('/comments', data)
}

export function deleteComment(id) {
  return request.delete(`/comments/${id}`)
}

export function likeComment(id) {
  return request.post(`/comments/${id}/like`)
}

export function unlikeComment(id) {
  return request.delete(`/comments/${id}/like`)
}
