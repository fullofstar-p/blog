import { reactive } from 'vue'
import request from './request'

/**
 * 通知模块 /api/notifications
 *
 * 未读数需要在「头部铃铛」与「通知页」之间共享；本任务的写作用域不包含 store 目录，
 * 因此把这份极轻量的共享状态放在 api 层，由通知页与头部共同读写。
 */
export const notificationUnread = reactive({ count: 0 })

/** 设置未读数（负数归零） */
export function setUnreadCount(count) {
  notificationUnread.count = Math.max(0, Number(count) || 0)
}

export function listNotifications(params) {
  return request.get('/notifications', { params })
}

export function getUnreadCount() {
  // 头部轮询用静默请求：失败不弹全局 Toast，避免网络抖动打扰阅读
  return request.get('/notifications/unread-count', { silent: true })
}

export function markNotificationRead(id) {
  return request.put(`/notifications/${id}/read`)
}

export function markAllNotificationsRead() {
  return request.put('/notifications/read-all')
}
