package com.blog.security;

import io.jsonwebtoken.Claims;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * JWT 认证过滤器：解析 Bearer token、校验 Redis 黑名单，并写入 SecurityContext。
 * 无 token / token 无效时直接放行，由 SecurityConfig 的 401 入口统一处理。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private static final String BLACKLIST_PREFIX = "jwt:blacklist:";

    private final JwtUtils jwtUtils;
    private final StringRedisTemplate stringRedisTemplate;

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request,
                                    @NonNull HttpServletResponse response,
                                    @NonNull FilterChain filterChain) throws ServletException, IOException {
        String token = jwtUtils.resolveToken(request.getHeader("Authorization"));
        if (token != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            try {
                Claims claims = jwtUtils.parseToken(token);
                String tokenType = jwtUtils.getTokenType(claims);
                String jti = claims.getId();
                boolean blacklisted = jti != null
                        && Boolean.TRUE.equals(stringRedisTemplate.hasKey(BLACKLIST_PREFIX + jti));
                // 仅接受 access token，且未进入黑名单（已登出）
                if (JwtUtils.TYPE_ACCESS.equals(tokenType) && !blacklisted) {
                    LoginUser loginUser = new LoginUser(
                            Long.valueOf(claims.getSubject()),
                            jwtUtils.getUsername(claims),
                            jwtUtils.getRole(claims));
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(loginUser, null,
                                    List.of(new SimpleGrantedAuthority("ROLE_" + loginUser.getRole())));
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);
                }
            } catch (Exception e) {
                // token 无效或过期：不写入上下文，后续由 401 入口处理
                log.debug("JWT 解析失败：{}", e.getMessage());
                SecurityContextHolder.clearContext();
            }
        }
        filterChain.doFilter(request, response);
    }
}
