package com.blog.vo;

import lombok.Data;
import lombok.EqualsAndHashCode;

/**
 * 后台评论视图对象：在一级评论字段基础上补充文章标题、审核状态、用户名。
 */
@Data
@EqualsAndHashCode(callSuper = true)
public class CommentAdminVO extends CommentVO {

    private String articleTitle;

    private Integer status;

    private String username;
}
