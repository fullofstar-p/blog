package com.blog.constant;

import java.time.Duration;

/**
 * Redis key 前缀与缓存时长。
 *
 * <p>同一个 key 可能在多个类里被读写（例如阅读量在文章服务写入、在定时任务落库），
 * 统一放在这里可以避免字符串字面量各写一份、改一处漏一处。</p>
 */
public final class RedisKeys {

    private RedisKeys() {
    }

    /** 登出后 access token 的黑名单 */
    public static final String JWT_BLACKLIST_PREFIX = "jwt:blacklist:";

    /** refresh token 白名单 */
    public static final String REFRESH_TOKEN_PREFIX = "refresh:";

    /** 文章详情缓存 */
    public static final String ARTICLE_DETAIL_PREFIX = "article:detail:";

    /** 文章阅读量增量 */
    public static final String ARTICLE_VIEW_COUNT_PREFIX = "article:views:";

    /** 待落库的文章阅读量集合 */
    public static final String ARTICLE_VIEW_PENDING_KEY = "article:views:pending";

    /** 评论点赞用户集合 */
    public static final String COMMENT_LIKE_PREFIX = "comment:like:";

    /** 站点每日 PV */
    public static final String STATS_PV_PREFIX = "stats:pv:";

    /** 站点每日 UV（HyperLogLog） */
    public static final String STATS_UV_PREFIX = "stats:uv:";

    /** 文章每日阅读量 */
    public static final String STATS_ARTICLE_PV_PREFIX = "stats:article:pv:";

    /** 待落库的统计日期集合 */
    public static final String STATS_PENDING_DATES_KEY = "stats:pending:dates";

    /** 文章详情缓存时长 */
    public static final Duration ARTICLE_DETAIL_TTL = Duration.ofMinutes(10);
}
