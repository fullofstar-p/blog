package com.blog.vo;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 站内通知视图对象。
 */
@Data
public class NotificationVO {

    private Long id;

    /** COMMENT / REPLY / COMMENT_AUDIT */
    private String type;

    private String title;

    private String content;

    private Long articleId;

    private String articleTitle;

    private Long commentId;

    private Long senderId;

    private String senderName;

    private String senderAvatar;

    /** 0 未读 / 1 已读 */
    private Integer isRead;

    private LocalDateTime createTime;
}
