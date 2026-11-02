package com.blog.constant;

/**
 * 内容看板的查询范围常量。
 */
public final class StatsConstants {

    private StatsConstants() {
    }

    /** 默认统计天数 */
    public static final int DEFAULT_DAYS = 30;

    /** 统计天数下限 */
    public static final int MIN_DAYS = 7;

    /** 统计天数上限 */
    public static final int MAX_DAYS = 90;

    /** 发布热力图覆盖的天数 */
    public static final int HEATMAP_DAYS = 365;

    /** 热门文章榜单条数 */
    public static final int TOP_LIMIT = 8;
}
