package com.blog.constant;

/**
 * 文章领域常量：状态、置顶标记与列表相关的阈值。
 */
public final class ArticleConstants {

    private ArticleConstants() {
    }

    /** 草稿 */
    public static final int STATUS_DRAFT = 0;

    /** 已发布 */
    public static final int STATUS_PUBLISHED = 1;

    /** 未置顶 */
    public static final int NOT_TOP = 0;

    /** 置顶 */
    public static final int TOP = 1;

    /** 自动摘要的最大长度 */
    public static final int SUMMARY_MAX_LENGTH = 120;

    /** 热门文章接口允许的最大条数 */
    public static final int TOP_MAX_LIMIT = 10;

    /** 相关文章接口允许的最大条数 */
    public static final int RELATED_MAX_LIMIT = 12;
}
