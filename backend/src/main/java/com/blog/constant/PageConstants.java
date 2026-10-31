package com.blog.constant;

/**
 * 分页与批量操作的通用参数。
 *
 * <p>控制器上的 {@code @RequestParam(defaultValue = "10")} 属于接口声明的一部分，
 * 这里统一的是服务层对页码/页大小的兜底与上限，避免各处散落 {@code 1}、{@code 50}、{@code 100}。</p>
 */
public final class PageConstants {

    private PageConstants() {
    }

    /** 页码下限 */
    public static final int MIN_PAGE_NUM = 1;

    /** 页大小下限 */
    public static final int MIN_PAGE_SIZE = 1;

    /** 页大小上限 */
    public static final int MAX_PAGE_SIZE = 50;

    /** 批量操作一次最多处理的记录数 */
    public static final int BATCH_MAX_SIZE = 100;
}
