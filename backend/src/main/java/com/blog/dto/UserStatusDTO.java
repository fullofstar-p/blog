package com.blog.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 管理端修改用户状态参数：1 启用 / 0 禁用。
 */
@Data
public class UserStatusDTO {

    @NotNull(message = "用户状态不能为空")
    @Min(value = 0, message = "用户状态不合法")
    @Max(value = 1, message = "用户状态不合法")
    private Integer status;
}
