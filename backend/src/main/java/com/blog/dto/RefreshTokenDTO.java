package com.blog.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

/**
 * 刷新令牌请求参数。
 */
@Data
public class RefreshTokenDTO {

    @NotBlank(message = "refreshToken 不能为空")
    private String refreshToken;
}
