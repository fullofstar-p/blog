package com.blog.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 评论审核请求参数：1 通过 / 2 拒绝。
 */
@Data
public class CommentAuditDTO {

    @NotNull(message = "审核状态不能为空")
    @Min(value = 1, message = "审核状态不合法")
    @Max(value = 2, message = "审核状态不合法")
    private Integer status;
}
