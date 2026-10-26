package com.blog.vo;

import lombok.Data;

/**
 * 标签视图对象。
 */
@Data
public class TagVO {

    private Long id;

    private String name;

    /** 已发布文章数 */
    private Integer articleCount;
}
