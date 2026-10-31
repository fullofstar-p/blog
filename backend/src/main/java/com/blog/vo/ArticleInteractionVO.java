package com.blog.vo;

import lombok.Data;

/**
 * 文章互动状态（点赞/收藏）。
 */
@Data
public class ArticleInteractionVO {

    private Boolean liked;

    private Boolean favorited;

    private Integer likeCount;

    private Integer favoriteCount;
}
