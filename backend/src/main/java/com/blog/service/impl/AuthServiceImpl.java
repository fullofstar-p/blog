package com.blog.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.blog.common.BusinessException;
import com.blog.common.ResultCode;
import com.blog.constant.RedisKeys;
import com.blog.constant.SecurityConstants;
import com.blog.constant.UserConstants;
import com.blog.dto.LoginDTO;
import com.blog.dto.RefreshTokenDTO;
import com.blog.dto.RegisterDTO;
import com.blog.entity.User;
import com.blog.mapper.UserMapper;
import com.blog.security.JwtUtils;
import com.blog.service.AuthService;
import com.blog.vo.TokenVO;
import com.blog.vo.UserVO;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.util.UUID;

/**
 * 认证服务实现：JWT 双 token + Redis 白名单/黑名单。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtUtils jwtUtils;
    private final StringRedisTemplate stringRedisTemplate;

    @Override
    @Transactional
    public void register(RegisterDTO dto) {
        Long count = userMapper.selectCount(
                new LambdaQueryWrapper<User>().eq(User::getUsername, dto.getUsername()));
        if (count != null && count > 0) {
            throw new BusinessException(ResultCode.CONFLICT, "用户名已存在");
        }
        User user = new User();
        user.setUsername(dto.getUsername());
        user.setPassword(passwordEncoder.encode(dto.getPassword()));
        user.setNickname(StringUtils.hasText(dto.getNickname())
                ? dto.getNickname().trim() : dto.getUsername());
        user.setEmail(StringUtils.hasText(dto.getEmail()) ? dto.getEmail().trim() : null);
        user.setRole(SecurityConstants.ROLE_USER);
        user.setStatus(UserConstants.STATUS_ENABLED);
        try {
            userMapper.insert(user);
        } catch (DuplicateKeyException e) {
            // 并发注册时以数据库唯一键兜底
            throw new BusinessException(ResultCode.CONFLICT, "用户名已存在");
        }
    }

    @Override
    public TokenVO login(LoginDTO dto) {
        try {
            Authentication authentication = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(dto.getUsername(), dto.getPassword()));
            log.debug("用户登录成功：{}", authentication.getName());
        } catch (DisabledException e) {
            throw new BusinessException(ResultCode.FORBIDDEN, "账号已被禁用");
        } catch (BadCredentialsException e) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "用户名或密码错误");
        } catch (AuthenticationException e) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "用户名或密码错误");
        }
        User user = userMapper.selectOne(
                new LambdaQueryWrapper<User>().eq(User::getUsername, dto.getUsername()));
        if (user == null) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "用户名或密码错误");
        }
        return buildToken(user);
    }

    @Override
    public TokenVO refresh(RefreshTokenDTO dto) {
        Claims claims;
        try {
            claims = jwtUtils.parseToken(dto.getRefreshToken());
        } catch (Exception e) {
            throw new BusinessException(ResultCode.UNAUTHORIZED, "刷新令牌无效或已过期");
        }
        if (!SecurityConstants.TOKEN_TYPE_REFRESH.equals(jwtUtils.getTokenType(claims))) {
            throw new BusinessException(ResultCode.UNAUTHORIZED, "刷新令牌无效");
        }
        Long userId = Long.valueOf(claims.getSubject());
        String jti = claims.getId();
        String refreshKey = RedisKeys.REFRESH_TOKEN_PREFIX + userId + ":" + jti;
        // 白名单不存在说明已登出或已轮换过
        if (!Boolean.TRUE.equals(stringRedisTemplate.hasKey(refreshKey))) {
            throw new BusinessException(ResultCode.UNAUTHORIZED, "刷新令牌已失效，请重新登录");
        }
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED, "用户不存在");
        }
        if (user.getStatus() == null || user.getStatus() != UserConstants.STATUS_ENABLED) {
            throw new BusinessException(ResultCode.FORBIDDEN, "账号已被禁用");
        }
        // refresh token 单次使用：轮换前删除旧白名单
        stringRedisTemplate.delete(refreshKey);
        return buildToken(user);
    }

    @Override
    public void logout(String accessToken, String refreshToken) {
        // access token 加入黑名单，TTL 取其剩余有效期
        if (StringUtils.hasText(accessToken)) {
            try {
                Claims claims = jwtUtils.parseToken(accessToken);
                if (SecurityConstants.TOKEN_TYPE_ACCESS.equals(jwtUtils.getTokenType(claims))
                        && claims.getId() != null) {
                    long ttl = jwtUtils.getRemainingSeconds(claims);
                    if (ttl > 0) {
                        stringRedisTemplate.opsForValue().set(
                                RedisKeys.JWT_BLACKLIST_PREFIX + claims.getId(), "1", Duration.ofSeconds(ttl));
                    }
                }
            } catch (Exception e) {
                log.debug("登出时 access token 已无效：{}", e.getMessage());
            }
        }
        // refresh token 从白名单删除
        if (StringUtils.hasText(refreshToken)) {
            try {
                Claims claims = jwtUtils.parseToken(refreshToken);
                if (SecurityConstants.TOKEN_TYPE_REFRESH.equals(jwtUtils.getTokenType(claims))) {
                    stringRedisTemplate.delete(
                            RedisKeys.REFRESH_TOKEN_PREFIX + claims.getSubject() + ":" + claims.getId());
                }
            } catch (Exception e) {
                log.debug("登出时 refresh token 已无效：{}", e.getMessage());
            }
        }
    }

    /** 生成 access + refresh token，并登记 refresh 白名单 */
    private TokenVO buildToken(User user) {
        String accessJti = UUID.randomUUID().toString().replace("-", "");
        String refreshJti = UUID.randomUUID().toString().replace("-", "");
        String accessToken = jwtUtils.generateAccessToken(user, accessJti);
        String refreshToken = jwtUtils.generateRefreshToken(user, refreshJti);
        stringRedisTemplate.opsForValue().set(
                RedisKeys.REFRESH_TOKEN_PREFIX + user.getId() + ":" + refreshJti,
                "1", Duration.ofSeconds(jwtUtils.getRefreshExpire()));

        TokenVO tokenVO = new TokenVO();
        tokenVO.setAccessToken(accessToken);
        tokenVO.setRefreshToken(refreshToken);
        tokenVO.setExpiresIn(jwtUtils.getAccessExpire());
        tokenVO.setUser(toUserVO(user));
        return tokenVO;
    }

    private UserVO toUserVO(User user) {
        UserVO vo = new UserVO();
        vo.setId(user.getId());
        vo.setUsername(user.getUsername());
        vo.setNickname(user.getNickname());
        vo.setAvatar(user.getAvatar());
        vo.setEmail(user.getEmail());
        vo.setRole(user.getRole());
        vo.setStatus(user.getStatus());
        vo.setCreateTime(user.getCreateTime());
        return vo;
    }
}
