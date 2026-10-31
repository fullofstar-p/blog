package com.blog.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.blog.common.BusinessException;
import com.blog.common.PageResult;
import com.blog.common.ResultCode;
import com.blog.entity.Notification;
import com.blog.mapper.NotificationMapper;
import com.blog.security.SecurityUtils;
import com.blog.service.NotificationService;
import com.blog.vo.NotificationVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * 站内通知服务实现。
 *
 * <p>注意：{@link #send} 使用 REQUIRES_NEW 独立事务：它通常在评论审核事务中被 try/catch 调用，
 * 独立事务可保证通知插入失败时只回滚通知本身，不会把审核事务标记为 rollback-only。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class NotificationServiceImpl implements NotificationService {

    private final NotificationMapper notificationMapper;

    @Override
    public PageResult<NotificationVO> page(int pageNum, int pageSize, boolean unreadOnly) {
        Long userId = SecurityUtils.getUserId();
        int current = Math.max(1, pageNum);
        int size = Math.min(Math.max(1, pageSize), 50);
        long total = notificationMapper.selectNotificationCount(userId, unreadOnly);
        Page<NotificationVO> page = new Page<>(current, size);
        page.setSearchCount(false);
        page.setTotal(total);
        IPage<NotificationVO> result = notificationMapper.selectNotificationPage(page, userId, unreadOnly);
        return PageResult.of(result);
    }

    @Override
    public long unreadCount() {
        Long userId = SecurityUtils.getUserId();
        Long count = notificationMapper.selectCount(new LambdaQueryWrapper<Notification>()
                .eq(Notification::getUserId, userId)
                .eq(Notification::getIsRead, 0));
        return count == null ? 0L : count;
    }

    @Override
    public void markRead(Long id) {
        Long userId = SecurityUtils.getUserId();
        Notification notification = notificationMapper.selectById(id);
        if (notification == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "通知不存在");
        }
        if (!userId.equals(notification.getUserId())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权操作他人的通知");
        }
        if (Integer.valueOf(1).equals(notification.getIsRead())) {
            return;
        }
        notificationMapper.update(null, new LambdaUpdateWrapper<Notification>()
                .eq(Notification::getId, id)
                .eq(Notification::getUserId, userId)
                .set(Notification::getIsRead, 1));
    }

    @Override
    public int markAllRead() {
        Long userId = SecurityUtils.getUserId();
        return notificationMapper.update(null, new LambdaUpdateWrapper<Notification>()
                .eq(Notification::getUserId, userId)
                .eq(Notification::getIsRead, 0)
                .set(Notification::getIsRead, 1));
    }

    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void send(Long userId, String type, String title, String content,
                     Long articleId, Long commentId, Long senderId) {
        if (userId == null) {
            return;
        }
        Notification notification = new Notification();
        notification.setUserId(userId);
        notification.setType(type);
        notification.setTitle(title);
        notification.setContent(content);
        notification.setArticleId(articleId);
        notification.setCommentId(commentId);
        notification.setSenderId(senderId);
        notification.setIsRead(0);
        notificationMapper.insert(notification);
    }
}
