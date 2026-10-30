package com.blog.service;

import com.blog.vo.DashboardVO;

/**
 * 内容看板与访问统计。
 */
public interface StatsService {

    /** 记录一次文章阅读（PV / UV / 文章每日阅读） */
    void recordView(Long articleId, String visitorKey);

    /** 管理端内容看板 */
    DashboardVO dashboard(int days);

    /** 把 Redis 中的访问增量落库（定时任务调用） */
    void flush();

    /** 彻底删除文章时清理其每日统计 */
    void purgeArticleStats(Long articleId);
}
