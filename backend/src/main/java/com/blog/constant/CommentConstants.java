package com.blog.constant;

/**
 * 评论领域常量：审核状态、嵌套层级与摘要长度。
 */
public final class CommentConstants {

    private CommentConstants() {
    }

    /** 待审核 */
    public static final int STATUS_PENDING = 0;

    /** 审核通过 */
    public static final int STATUS_APPROVED = 1;

    /** 审核拒绝 */
    public static final int STATUS_REJECTED = 2;

    /** 最大嵌套层级：0 为一级，4 为第五层 */
    public static final int MAX_DEPTH = 4;

    /** 通知内容中引用的评论摘要最大长度 */
    public static final int EXCERPT_MAX_LENGTH = 60;
}
