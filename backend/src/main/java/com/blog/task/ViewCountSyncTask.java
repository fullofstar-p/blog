package com.blog.task;

import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.blog.constant.RedisKeys;
import com.blog.entity.Article;
import com.blog.mapper.ArticleMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Set;

/**
 * 阅读量落库定时任务：每 60 秒把 Redis 中的增量批量写回 MySQL。
 * 采用「先读增量 -> 落库 -> 原子扣减」的顺序，避免并发浏览的增量丢失。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ViewCountSyncTask {

    private final StringRedisTemplate stringRedisTemplate;
    private final ArticleMapper articleMapper;

    @Scheduled(fixedDelay = 60_000L, initialDelay = 60_000L)
    public void syncViewCounts() {
        Set<String> pendingIds = stringRedisTemplate.opsForSet().members(RedisKeys.ARTICLE_VIEW_PENDING_KEY);
        if (pendingIds == null || pendingIds.isEmpty()) {
            return;
        }
        for (String idText : pendingIds) {
            if (!StringUtils.hasText(idText)) {
                continue;
            }
            Long articleId;
            try {
                articleId = Long.valueOf(idText);
            } catch (NumberFormatException e) {
                stringRedisTemplate.opsForSet().remove(RedisKeys.ARTICLE_VIEW_PENDING_KEY, idText);
                continue;
            }
            String viewKey = RedisKeys.ARTICLE_VIEW_COUNT_PREFIX + articleId;
            try {
                String raw = stringRedisTemplate.opsForValue().get(viewKey);
                long delta = raw == null ? 0L : Long.parseLong(raw);
                if (delta <= 0) {
                    stringRedisTemplate.delete(viewKey);
                    stringRedisTemplate.opsForSet().remove(RedisKeys.ARTICLE_VIEW_PENDING_KEY, idText);
                    continue;
                }
                articleMapper.update(null, new LambdaUpdateWrapper<Article>()
                        .eq(Article::getId, articleId)
                        .setSql("view_count = view_count + " + delta));
                // 原子扣减已落库的增量，保留落库期间新增的浏览
                Long remaining = stringRedisTemplate.opsForValue().increment(viewKey, -delta);
                if (remaining != null && remaining <= 0) {
                    stringRedisTemplate.delete(viewKey);
                    stringRedisTemplate.opsForSet().remove(RedisKeys.ARTICLE_VIEW_PENDING_KEY, idText);
                }
                log.debug("文章阅读量落库：articleId={}, delta={}", articleId, delta);
            } catch (Exception e) {
                // 单条失败不影响其他文章，留在待落库集合中下轮重试
                log.warn("文章阅读量落库失败：articleId={}，原因：{}", articleId, e.getMessage());
            }
        }
    }
}
