import request from './request'

/** 搜索模块 /api/search */

export function searchArticles(params) {
  return request.get('/search', { params })
}
