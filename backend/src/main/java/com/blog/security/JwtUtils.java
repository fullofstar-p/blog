package com.blog.security;

import com.blog.constant.SecurityConstants;
import com.blog.entity.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.Date;

/**
 * JWT 工具类：签发 access / refresh 两类 token（HS256 + jti），并负责解析。
 */
@Component
public class JwtUtils {

    @Value("${jwt.secret}")
    private String secret;

    @Value("${jwt.access-expire}")
    private long accessExpire;

    @Value("${jwt.refresh-expire}")
    private long refreshExpire;

    private SecretKey secretKey;

    @PostConstruct
    public void init() {
        byte[] bytes = secret.getBytes(StandardCharsets.UTF_8);
        // HS256 要求密钥至少 256 位；过短时用 SHA-256 派生，避免启动失败
        if (bytes.length < 32) {
            try {
                bytes = MessageDigest.getInstance("SHA-256").digest(bytes);
            } catch (NoSuchAlgorithmException e) {
                throw new IllegalStateException("初始化 JWT 密钥失败", e);
            }
        }
        this.secretKey = Keys.hmacShaKeyFor(bytes);
    }

    /** 签发 access token */
    public String generateAccessToken(User user, String jti) {
        return generate(user, jti, SecurityConstants.TOKEN_TYPE_ACCESS, accessExpire);
    }

    /** 签发 refresh token */
    public String generateRefreshToken(User user, String jti) {
        return generate(user, jti, SecurityConstants.TOKEN_TYPE_REFRESH, refreshExpire);
    }

    private String generate(User user, String jti, String type, long ttlSeconds) {
        Date now = new Date();
        Date expiration = new Date(now.getTime() + ttlSeconds * 1000L);
        return Jwts.builder()
                .id(jti)
                .subject(String.valueOf(user.getId()))
                .claim("username", user.getUsername())
                .claim("role", user.getRole())
                .claim("type", type)
                .issuedAt(now)
                .expiration(expiration)
                .signWith(secretKey, Jwts.SIG.HS256)
                .compact();
    }

    /**
     * 解析并校验 token 签名与有效期；无效/过期会抛出 JwtException。
     */
    public Claims parseToken(String token) {
        return Jwts.parser()
                .verifyWith(secretKey)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    /** 读取 token 类型（access / refresh） */
    public String getTokenType(Claims claims) {
        Object value = claims.get("type");
        return value == null ? null : String.valueOf(value);
    }

    /** 读取用户名 */
    public String getUsername(Claims claims) {
        Object value = claims.get("username");
        return value == null ? null : String.valueOf(value);
    }

    /** 读取角色 */
    public String getRole(Claims claims) {
        Object value = claims.get("role");
        return value == null ? null : String.valueOf(value);
    }

    /** 计算 token 剩余有效秒数（用于黑名单 TTL） */
    public long getRemainingSeconds(Claims claims) {
        Date expiration = claims.getExpiration();
        if (expiration == null) {
            return 0L;
        }
        return Math.max(0L, (expiration.getTime() - System.currentTimeMillis()) / 1000L);
    }

    /**
     * 从 Authorization 请求头中提取 Bearer token。
     */
    public String resolveToken(String authorizationHeader) {
        if (authorizationHeader == null || !authorizationHeader.startsWith(SecurityConstants.BEARER_PREFIX)) {
            return null;
        }
        String token = authorizationHeader.substring(SecurityConstants.BEARER_PREFIX.length()).trim();
        return token.isEmpty() ? null : token;
    }

    public long getAccessExpire() {
        return accessExpire;
    }

    public long getRefreshExpire() {
        return refreshExpire;
    }
}
