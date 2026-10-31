package com.blog.entity;

import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * 文章-标签关联表实体（联合主键，无自增 id）。
 * 关联的读写由 {@link com.blog.mapper.ArticleTagMapper} 中的显式 SQL 维护。
 */
@Data
@TableName("article_tag")
public class ArticleTag {

    private Long articleId;

    private Long tagId;
}
