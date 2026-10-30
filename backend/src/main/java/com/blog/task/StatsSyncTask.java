package com.blog.task;

import com.blog.service.StatsService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * 访问统计落库任务：每 60 秒把 Redis 中的 PV/UV 与文章每日阅读增量写入 MySQL。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class StatsSyncTask {

    private final StatsService statsService;

    @Scheduled(fixedDelay = 60_000L, initialDelay = 30_000L)
    public void syncStats() {
        try {
            statsService.flush();
        } catch (Exception e) {
            log.warn("访问统计定时落库失败：{}", e.getMessage());
        }
    }
}
