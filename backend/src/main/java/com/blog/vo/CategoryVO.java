package com.blog.vo;

import lombok.Data;

/**
 * 分类视图对象。
 */
@Data
public class CategoryVO {

    private Long id;

    private String name;

    private Integer sort;

    /** 已发布文章数 */
    private Integer articleCount;
}
