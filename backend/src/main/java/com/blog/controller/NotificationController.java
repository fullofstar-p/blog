package com.blog.controller;

import com.blog.common.PageResult;
import com.blog.common.Result;
import com.blog.service.NotificationService;
import com.blog.vo.NotificationVO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * 站内通知接口：/api/notifications（需登录）。
 */
@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final NotificationService notificationService;

    /** 通知分页；unreadOnly=true 只看未读 */
    @GetMapping
    public Result<PageResult<NotificationVO>> list(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(defaultValue = "false") boolean unreadOnly) {
        return Result.success(notificationService.page(pageNum, pageSize, unreadOnly));
    }

    /** 未读数 */
    @GetMapping("/unread-count")
    public Result<Map<String, Object>> unreadCount() {
        return Result.success(Map.of("count", notificationService.unreadCount()));
    }

    /** 全部标记已读 */
    @PutMapping("/read-all")
    public Result<Map<String, Object>> readAll() {
        return Result.success(Map.of("updated", notificationService.markAllRead()));
    }

    /** 单条标记已读（只能操作自己的通知） */
    @PutMapping("/{id}/read")
    public Result<Void> markRead(@PathVariable Long id) {
        notificationService.markRead(id);
        return Result.success();
    }
}
