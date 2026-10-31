package com.blog.service;

import com.blog.common.PageResult;
import com.blog.vo.NotificationVO;

/**
 * 站内通知服务。
 */
public interface NotificationService {

    /** 当前用户通知分页（按时间倒序） */
    PageResult<NotificationVO> page(int pageNum, int pageSize, boolean unreadOnly);

    /** 当前用户未读数 */
    long unreadCount();

    /** 标记单条已读（只能操作自己的通知） */
    void markRead(Long id);

    /** 全部标记已读，返回更新条数 */
    int markAllRead();

    /**
     * 发送通知（单条插入，不参与调用方事务）。
     * 发送失败会抛异常，由调用方 try/catch 决定是否影响主流程。
     */
    void send(Long userId, String type, String title, String content,
              Long articleId, Long commentId, Long senderId);
}
