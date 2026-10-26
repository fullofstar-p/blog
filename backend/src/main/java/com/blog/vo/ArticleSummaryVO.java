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
    private List<TagVO> tags;
    private LocalDateTime createTime;
    private LocalDateTime updateTime;
}
