import request from './request'

/** 标签模块（公开列表） */

export function listTags() {
  return request.get('/tags')
}
