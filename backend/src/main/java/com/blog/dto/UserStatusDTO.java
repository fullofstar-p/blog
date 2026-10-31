package com.blog.dto;

import com.blog.constant.UserConstants;

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
    @Min(value = UserConstants.STATUS_DISABLED, message = "用户状态不合法")
    @Max(value = UserConstants.STATUS_ENABLED, message = "用户状态不合法")
    private Integer status;
}
