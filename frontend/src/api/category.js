import request from './request'

/** 分类模块（公开列表） */

export function listCategories() {
  return request.get('/categories')
}
