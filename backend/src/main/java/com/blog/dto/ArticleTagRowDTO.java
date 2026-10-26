package com.blog.dto;

import lombok.Data;

/**
 * 文章-标签批量查询行：分页列表按当前页 articleId 一次查出标签，
 * 避免原先每篇文章一个相关子查询带来的慢查询。
 */
@Data
public class ArticleTagRowDTO {

    private Long articleId;

    private Long tagId;

    private String tagName;

    /** 该标签下已发布文章数 */
    private Integer articleCount;
}
