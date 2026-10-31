package com.blog.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 文章摘要视图对象（列表/搜索/创建回显）。
 */
@Data
public class ArticleSummaryVO {

    private Long id;
    private String title;
    private String summary;
    private String cover;
    private Long categoryId;
    private String categoryName;
    private Long authorId;
    private String authorName;
    private String authorAvatar;
    private Integer status;
    private Integer isTop;
    private Integer viewCount;
    private Integer likeCount;
    private Integer favoriteCount;
    private List<TagVO> tags;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;

    /** 仅回收站列表返回：进入回收站的时间 */
    private LocalDateTime deletedTime;

    /** 仅「我的收藏」列表返回：收藏时间 */
    private LocalDateTime favoriteTime;
}
