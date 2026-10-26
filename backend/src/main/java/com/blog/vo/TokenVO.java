package com.blog.vo;

import lombok.Data;

/**
 * 登录/刷新返回的令牌对象。
 */
@Data
public class TokenVO {

    private String accessToken;

    private String refreshToken;

    /** 固定为 Bearer */
    private String tokenType = "Bearer";

    /** access token 有效期（秒） */
    private Long expiresIn;

    private UserVO user;
}
