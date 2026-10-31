package com.blog.common;

/**
 * 站内通知类型常量。
 */
public final class NotificationType {

    /** 文章收到新评论 */
    public static final String COMMENT = "COMMENT";

    /** 有人回复了我的评论 */
    public static final String REPLY = "REPLY";

    /** 评论审核结果 */
    public static final String COMMENT_AUDIT = "COMMENT_AUDIT";

    private NotificationType() {
    }
}
