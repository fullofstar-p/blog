package com.blog.vo;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 内容看板热门文章。
 */
@Data
public class TopArticleVO {

    private Long id;

    private String title;

    private Integer status;

    private Integer viewCount;

    /** 所选区间内的阅读量（来自 article_daily_stat） */
    private Long rangePv;

    private LocalDateTime createTime;

    private String categoryName;

    private String authorName;
}
