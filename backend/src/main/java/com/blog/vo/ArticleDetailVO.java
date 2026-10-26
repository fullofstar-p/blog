package com.blog.vo;

import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 文章详情视图对象：摘要信息 + 正文 + 上一篇/下一篇。
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class ArticleDetailVO extends ArticleSummaryVO {

    private String content;

    private ArticleNavVO prev;

    private ArticleNavVO next;
}
