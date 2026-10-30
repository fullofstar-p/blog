package com.blog.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 管理端内容看板数据。
 */
@Data
public class DashboardVO {

    private LocalDateTime generatedAt;

    private Totals totals;

    private Today today;

    private Range range;

    private List<TrendPoint> trend;

    private List<TopArticleVO> topArticles;

    private PublishHeatmap publish;

    @Data
    public static class Totals {
        private long articles;
        private long published;
        private long drafts;
        private long views;
        private long users;
        private long comments;
        private long categories;
        private long tags;
    }

    @Data
    public static class Today {
        private String date;
        private long pv;
        private long uv;
    }

    @Data
    public static class Range {
        private String startDate;
        private String endDate;
        private int days;
        private long pv;
        /** 按日去重 UV 的合计（不是跨天去重） */
        private long uv;
    }

    @Data
    public static class TrendPoint {
        private String date;
        private long pv;
        private long uv;
    }

    @Data
    public static class PublishHeatmap {
        private long total;
        private int currentStreak;
        private int longestStreak;
        private long maxCount;
        private List<HeatmapDay> days;
    }

    @Data
    public static class HeatmapDay {
        private String date;
        private long count;
    }
}
