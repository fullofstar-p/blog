package com.blog.controller;

import com.blog.common.Result;
import com.blog.dto.LoginDTO;
import com.blog.dto.RefreshTokenDTO;
import com.blog.dto.RegisterDTO;
import com.blog.security.JwtUtils;
import com.blog.service.AuthService;
import com.blog.vo.TokenVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 认证接口：/api/auth/**。
 */
@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;
    private final JwtUtils jwtUtils;

    @PostMapping("/register")
    public Result<Void> register(@Valid @RequestBody RegisterDTO dto) {
        authService.register(dto);
        return Result.success();
    }

    @PostMapping("/login")
    public Result<TokenVO> login(@Valid @RequestBody LoginDTO dto) {
        return Result.success(authService.login(dto));
    }

    @PostMapping("/refresh")
    public Result<TokenVO> refresh(@Valid @RequestBody RefreshTokenDTO dto) {
        return Result.success(authService.refresh(dto));
    }

    @PostMapping("/logout")
    public Result<Void> logout(@RequestHeader(value = "Authorization", required = false) String authorization,
                               @RequestBody(required = false) RefreshTokenDTO dto) {
        authService.logout(jwtUtils.resolveToken(authorization),
                dto == null ? null : dto.getRefreshToken());
        return Result.success();
    }
}
