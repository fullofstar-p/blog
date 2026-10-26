import request from './request'

/** 认证模块 /api/auth */

export function register(data) {
  return request.post('/auth/register', data)
}

export function login(data) {
  return request.post('/auth/login', data)
}

export function refresh(refreshToken) {
  return request.post('/auth/refresh', { refreshToken }, { silent: true })
}

export function logout(data = {}) {
  return request.post('/auth/logout', data)
}
