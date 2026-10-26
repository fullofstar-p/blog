package com.blog.service;

import com.blog.dto.LoginDTO;
import com.blog.dto.RefreshTokenDTO;
import com.blog.dto.RegisterDTO;
import com.blog.vo.TokenVO;

/**
 * 认证服务。
 */
public interface AuthService {

    /** 注册（默认 USER 角色） */
    void register(RegisterDTO dto);

    /** 登录，返回 access + refresh token */
    TokenVO login(LoginDTO dto);

    /** 刷新 token（refresh token 单次使用，成功后轮换） */
    TokenVO refresh(RefreshTokenDTO dto);

    /** 退出登录：access 进黑名单，refresh 从白名单移除 */
    void logout(String accessToken, String refreshToken);
}
