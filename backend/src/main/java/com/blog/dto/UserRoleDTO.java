package com.blog.dto;

import com.blog.constant.SecurityConstants;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.Data;

/**
 * 管理端修改用户角色参数。
 */
@Data
public class UserRoleDTO {

    @NotBlank(message = "角色不能为空")
    @Pattern(regexp = SecurityConstants.ROLE_PATTERN, message = "角色只能为 ADMIN 或 USER")
    private String role;
}
