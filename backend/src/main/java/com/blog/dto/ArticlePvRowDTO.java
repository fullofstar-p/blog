package com.blog.dto;

import lombok.Data;

/**
 * 文章区间阅读量聚合行。
 */
@Data
public class ArticlePvRowDTO {

    private Long articleId;

    private Long pv;
}
