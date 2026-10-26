import request from './request'

/** 用户模块 /api/users */

export function getMe() {
  return request.get('/users/me')
}

export function updateMe(data) {
  return request.put('/users/me', data)
}

export function changePassword(data) {
  return request.put('/users/me/password', data)
}
