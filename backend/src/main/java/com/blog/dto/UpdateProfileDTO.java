package com.blog.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 修改个人资料请求参数。
 */
@Data
public class UpdateProfileDTO {

    @Size(max = 50, message = "昵称不能超过 50 个字符")
    private String nickname;

    @Email(message = "邮箱格式不正确")
    @Size(max = 100, message = "邮箱不能超过 100 个字符")
    private String email;

    @Size(max = 500, message = "头像地址不能超过 500 个字符")
    private String avatar;
}
