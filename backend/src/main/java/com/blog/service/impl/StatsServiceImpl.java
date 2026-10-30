package com.blog.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.blog.dto.ArticlePvRowDTO;
import com.blog.dto.DailyStatRowDTO;
import com.blog.dto.HeatmapRowDTO;
import com.blog.entity.Article;
import com.blog.mapper.ArticleMapper;
import com.blog.mapper.CategoryMapper;
import com.blog.mapper.CommentMapper;
import com.blog.mapper.StatsMapper;
import com.blog.mapper.TagMapper;
import com.blog.mapper.UserMapper;
import com.blog.service.StatsService;
import com.blog.vo.DashboardVO;
import com.blog.vo.TopArticleVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * 内容看板实现。
 *
 * <p>访问数据先写 Redis（PV 计数、UV HyperLogLog、文章每日阅读 Hash），
 * 每 60 秒由 StatsSyncTask 把增量落库；看板读取 MySQL 历史数据，
 * 再叠加当天尚未落库的 Redis 增量，保证「今日实时、历史可查」。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class StatsServiceImpl implements StatsService {

    private static final ZoneId ZONE = ZoneId.of("Asia/Shanghai");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ISO_LOCAL_DATE;

    private static final String PV_PREFIX = "stats:pv:";
    private static final String UV_PREFIX = "stats:uv:";
    private static final String ARTICLE_PV_PREFIX = "stats:article:pv:";
    private static final String PENDING_DATES_KEY = "stats:pending:dates";

    private static final int DEFAULT_DAYS = 30;
    private static final int MIN_DAYS = 7;
    private static final int MAX_DAYS = 90;
    private static final int HEATMAP_DAYS = 365;
    private static final int TOP_LIMIT = 8;

    private final StringRedisTemplate stringRedisTemplate;
    private final StatsMapper statsMapper;
    private final ArticleMapper articleMapper;
    private final UserMapper userMapper;
    private final CommentMapper commentMapper;
    private final CategoryMapper categoryMapper;
    private final TagMapper tagMapper;

    @Override
    public void recordView(Long articleId, String visitorKey) {
        if (articleId == null || visitorKey == null || visitorKey.isBlank()) {
            return;
        }
        String date = LocalDate.now(ZONE).format(DATE);
        try {
            stringRedisTemplate.opsForValue().increment(PV_PREFIX + date);
            stringRedisTemplate.opsForHyperLogLog().add(UV_PREFIX + date, visitorKey);
            stringRedisTemplate.opsForHash().increment(ARTICLE_PV_PREFIX + date, String.valueOf(articleId), 1);
            stringRedisTemplate.opsForSet().add(PENDING_DATES_KEY, date);
        } catch (Exception e) {
            // 统计数据不能影响正常阅读
            log.warn("记录访问统计失败：articleId={}，原因：{}", articleId, e.getMessage());
        }
    }

    @Override
    public DashboardVO dashboard(int days) {
        int rangeDays = Math.min(Math.max(days <= 0 ? DEFAULT_DAYS : days, MIN_DAYS), MAX_DAYS);
        LocalDate today = LocalDate.now(ZONE);
        LocalDate start = today.minusDays(rangeDays - 1L);

        List<DailyStatRowDTO> rows = statsMapper.selectSiteDaily(start, today);
        Map<String, DailyStatRowDTO> dailyMap = new HashMap<>();
        for (DailyStatRowDTO row : rows) {
            if (row.getStatDate() != null) {
                dailyMap.put(row.getStatDate().format(DATE), row);
            }
        }

        long redisPv = readLong(PV_PREFIX + today.format(DATE));
        long redisUv = readUv(today);

        DashboardVO vo = new DashboardVO();
        vo.setGeneratedAt(LocalDateTime.now(ZONE));

        DashboardVO.Totals totals = new DashboardVO.Totals();
        totals.setArticles(count(articleMapper.selectCount(null)));
        totals.setPublished(count(articleMapper.selectCount(
                new LambdaQueryWrapper<Article>().eq(Article::getStatus, 1))));
        totals.setDrafts(count(articleMapper.selectCount(
                new LambdaQueryWrapper<Article>().eq(Article::getStatus, 0))));
        totals.setViews(statsMapper.selectTotalViews());
        totals.setUsers(count(userMapper.selectCount(null)));
        totals.setComments(count(commentMapper.selectCount(null)));
        totals.setCategories(count(categoryMapper.selectCount(null)));
        totals.setTags(count(tagMapper.selectCount(null)));
        vo.setTotals(totals);

        List<DashboardVO.TrendPoint> trend = new ArrayList<>(rangeDays);
        long rangePv = 0;
        long rangeUv = 0;
        for (int i = 0; i < rangeDays; i++) {
            LocalDate date = start.plusDays(i);
            String key = date.format(DATE);
            DailyStatRowDTO row = dailyMap.get(key);
            long pv = row == null || row.getPv() == null ? 0L : row.getPv();
            long uv = row == null || row.getUv() == null ? 0L : row.getUv();
            if (date.equals(today)) {
                pv += redisPv;
                uv = Math.max(uv, redisUv);
            }
            DashboardVO.TrendPoint point = new DashboardVO.TrendPoint();
            point.setDate(key);
            point.setPv(pv);
            point.setUv(uv);
            trend.add(point);
            rangePv += pv;
            rangeUv += uv;
        }
        vo.setTrend(trend);

        DailyStatRowDTO todayRow = dailyMap.get(today.format(DATE));
        long todayPv = (todayRow == null || todayRow.getPv() == null ? 0L : todayRow.getPv()) + redisPv;
        long todayUv = Math.max(todayRow == null || todayRow.getUv() == null ? 0L : todayRow.getUv(), redisUv);
        DashboardVO.Today todayVo = new DashboardVO.Today();
        todayVo.setDate(today.format(DATE));
        todayVo.setPv(todayPv);
        todayVo.setUv(todayUv);
        vo.setToday(todayVo);

        DashboardVO.Range rangeVo = new DashboardVO.Range();
        rangeVo.setStartDate(start.format(DATE));
        rangeVo.setEndDate(today.format(DATE));
        rangeVo.setDays(rangeDays);
        rangeVo.setPv(rangePv);
        rangeVo.setUv(rangeUv);
        vo.setRange(rangeVo);

        vo.setTopArticles(buildTopArticles(start, today));
        vo.setPublish(buildPublishHeatmap(today));
        return vo;
    }

    @Override
    public void flush() {
        Set<String> dates = stringRedisTemplate.opsForSet().members(PENDING_DATES_KEY);
        if (dates == null || dates.isEmpty()) {
            return;
        }
        LocalDate today = LocalDate.now(ZONE);
        for (String dateText : dates) {
            LocalDate date;
            try {
                date = LocalDate.parse(dateText, DATE);
            } catch (Exception e) {
                stringRedisTemplate.opsForSet().remove(PENDING_DATES_KEY, dateText);
                continue;
            }
            try {
                flushDate(date, today);
            } catch (Exception e) {
                // 单日失败留在 pending 集合里下轮重试
                log.warn("访问统计落库失败：date={}，原因：{}", dateText, e.getMessage());
            }
        }
    }

    @Override
    public void purgeArticleStats(Long articleId) {
        if (articleId != null) {
            statsMapper.deleteArticleDaily(articleId);
        }
    }

    private void flushDate(LocalDate date, LocalDate today) {
        String dateText = date.format(DATE);
        String pvKey = PV_PREFIX + dateText;
        String uvKey = UV_PREFIX + dateText;
        String hashKey = ARTICLE_PV_PREFIX + dateText;

        long pvDelta = 0L;
        try {
            String raw = stringRedisTemplate.opsForValue().getAndDelete(pvKey);
            pvDelta = raw == null ? 0L : parseLong(raw);
        } catch (Exception e) {
            log.warn("读取 PV 增量失败：date={}，原因：{}", dateText, e.getMessage());
        }

        long uvSnapshot = readUv(date);

        Map<Object, Object> articlePv = new LinkedHashMap<>();
        try {
            if (Boolean.TRUE.equals(stringRedisTemplate.hasKey(hashKey))) {
                String tempKey = hashKey + ":flush:" + UUID.randomUUID();
                stringRedisTemplate.rename(hashKey, tempKey);
                articlePv = stringRedisTemplate.opsForHash().entries(tempKey);
                stringRedisTemplate.delete(tempKey);
            }
        } catch (Exception e) {
            log.warn("读取文章阅读增量失败：date={}，原因：{}", dateText, e.getMessage());
        }

        if (pvDelta > 0 || uvSnapshot > 0 || !articlePv.isEmpty()) {
            statsMapper.upsertSiteDaily(date, pvDelta, uvSnapshot);
            for (Map.Entry<Object, Object> entry : articlePv.entrySet()) {
                try {
                    Long articleId = Long.valueOf(String.valueOf(entry.getKey()));
                    long pv = parseLong(String.valueOf(entry.getValue()));
                    if (pv > 0) {
                        statsMapper.upsertArticleDaily(date, articleId, pv);
                    }
                } catch (NumberFormatException e) {
                    log.warn("非法文章阅读统计：date={}, key={}", dateText, entry.getKey());
                }
            }
        }

        // 历史日期的 UV HyperLogLog 已不会再变化，落库后清理；pending 也一并移除
        if (date.isBefore(today)) {
            stringRedisTemplate.delete(uvKey);
            stringRedisTemplate.opsForSet().remove(PENDING_DATES_KEY, dateText);
        }
    }

    private List<TopArticleVO> buildTopArticles(LocalDate start, LocalDate today) {
        List<ArticlePvRowDTO> rangeRows = statsMapper.selectArticleDailyPv(start, today);
        boolean hasRangeData = rangeRows.stream()
                .anyMatch(row -> row.getPv() != null && row.getPv() > 0);
        if (hasRangeData) {
            // 区间内有新增阅读：按区间 PV 排名，没有历史阅读的文章也能上榜
            return statsMapper.selectTopArticlesByRange(start, today, TOP_LIMIT);
        }
        // 还没有每日阅读数据时退回总阅读量，避免看板一开始就是空的
        return statsMapper.selectTopArticles(TOP_LIMIT);
    }

    private DashboardVO.PublishHeatmap buildPublishHeatmap(LocalDate today) {
        LocalDate start = today.minusDays(HEATMAP_DAYS - 1L);
        List<HeatmapRowDTO> rows = statsMapper.selectPublishHeatmap(start);
        Map<String, Long> counts = new HashMap<>();
        for (HeatmapRowDTO row : rows) {
            if (row.getStatDate() != null) {
                counts.put(row.getStatDate(), row.getCount() == null ? 0L : row.getCount());
            }
        }

        List<DashboardVO.HeatmapDay> days = new ArrayList<>(HEATMAP_DAYS);
        long total = 0L;
        long maxCount = 0L;
        for (int i = 0; i < HEATMAP_DAYS; i++) {
            String key = start.plusDays(i).format(DATE);
            long count = counts.getOrDefault(key, 0L);
            DashboardVO.HeatmapDay day = new DashboardVO.HeatmapDay();
            day.setDate(key);
            day.setCount(count);
            days.add(day);
            total += count;
            maxCount = Math.max(maxCount, count);
        }

        // 当前连续：今天还没发布时从昨天开始算，避免早上打开看板连续天数归零
        int currentStreak = 0;
        LocalDate cursor = today;
        if (counts.getOrDefault(today.format(DATE), 0L) == 0L) {
            cursor = today.minusDays(1);
        }
        while (!cursor.isBefore(start) && counts.getOrDefault(cursor.format(DATE), 0L) > 0L) {
            currentStreak++;
            cursor = cursor.minusDays(1);
        }

        int longestStreak = 0;
        int running = 0;
        for (DashboardVO.HeatmapDay day : days) {
            if (day.getCount() > 0) {
                running++;
                longestStreak = Math.max(longestStreak, running);
            } else {
                running = 0;
            }
        }

        DashboardVO.PublishHeatmap heatmap = new DashboardVO.PublishHeatmap();
        heatmap.setTotal(total);
        heatmap.setCurrentStreak(currentStreak);
        heatmap.setLongestStreak(longestStreak);
        heatmap.setMaxCount(maxCount);
        heatmap.setDays(days);
        return heatmap;
    }

    private long readUv(LocalDate date) {
        try {
            Long size = stringRedisTemplate.opsForHyperLogLog().size(UV_PREFIX + date.format(DATE));
            return size == null ? 0L : size;
        } catch (Exception e) {
            log.warn("读取 UV 失败：date={}，原因：{}", date.format(DATE), e.getMessage());
            return 0L;
        }
    }

    private long readLong(String key) {
        try {
            String raw = stringRedisTemplate.opsForValue().get(key);
            return raw == null ? 0L : parseLong(raw);
        } catch (Exception e) {
            log.warn("读取统计值失败：key={}，原因：{}", key, e.getMessage());
            return 0L;
        }
    }

    private long parseLong(String value) {
        try {
            return Long.parseLong(value);
        } catch (NumberFormatException e) {
            return 0L;
        }
    }

    private long count(Long value) {
        return value == null ? 0L : value;
    }
}
