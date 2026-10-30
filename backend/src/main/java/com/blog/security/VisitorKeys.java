package com.blog.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * 访问统计用的访客标识。
 *
 * <p>登录用户用 user:{id}；匿名访客用 IP + User-Agent 的 SHA-256，
 * 只用于 UV 去重，不落库、不对外返回。反向代理下优先取 X-Forwarded-For。</p>
 */
public final class VisitorKeys {

    private VisitorKeys() {
    }

    public static String of(HttpServletRequest request) {
        LoginUser loginUser = SecurityUtils.getLoginUserOrNull();
        if (loginUser != null && loginUser.getId() != null) {
            return "u:" + loginUser.getId();
        }
        String ip = clientIp(request);
        String userAgent = request.getHeader("User-Agent");
        String raw = ip + "|" + (userAgent == null ? "" : userAgent);
        return "a:" + sha256Hex(raw);
    }

    private static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (StringUtils.hasText(forwarded)) {
            String first = forwarded.split(",")[0].trim();
            if (StringUtils.hasText(first)) {
                return first;
            }
        }
        String realIp = request.getHeader("X-Real-IP");
        if (StringUtils.hasText(realIp)) {
            return realIp.trim();
        }
        String remote = request.getRemoteAddr();
        return remote == null ? "" : remote;
    }

    private static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder hex = new StringBuilder(bytes.length * 2);
            for (byte b : bytes) {
                hex.append(Character.forDigit((b >> 4) & 0xF, 16));
                hex.append(Character.forDigit(b & 0xF, 16));
            }
            return hex.toString();
        } catch (NoSuchAlgorithmException e) {
            // SHA-256 是 JDK 必备算法，正常不会走到这里
            return Integer.toHexString(value.hashCode());
        }
    }
}
