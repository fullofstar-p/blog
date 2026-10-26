package com.blog.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 发表评论请求参数。
 */
@Data
public class CommentCreateDTO {

    @NotNull(message = "文章 ID 不能为空")
    private Long articleId;

    /** 父评论 ID：为空表示一级评论 */
    private Long parentId;

    @NotBlank(message = "评论内容不能为空")
    @Size(max = 1000, message = "评论内容不能超过 1000 个字符")
    private String content;
}
