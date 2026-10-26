package com.blog.security;

import com.blog.common.BusinessException;
import com.blog.common.ResultCode;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/**
 * 当前登录用户工具类。
 */
public final class SecurityUtils {

    private SecurityUtils() {
    }

    /**
     * 获取当前登录用户；未登录返回 null。
     */
    public static LoginUser getLoginUserOrNull() {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication != null && authentication.getPrincipal() instanceof LoginUser loginUser) {
            return loginUser;
        }
        return null;
    }

    /**
     * 获取当前登录用户；未登录直接抛 401 业务异常。
     */
    public static LoginUser getLoginUser() {
        LoginUser loginUser = getLoginUserOrNull();
        if (loginUser == null) {
            throw new BusinessException(ResultCode.UNAUTHORIZED);
        }
        return loginUser;
    }

    public static Long getUserId() {
        return getLoginUser().getId();
    }

    public static boolean isAdmin() {
        LoginUser loginUser = getLoginUserOrNull();
        return loginUser != null && loginUser.isAdmin();
    }
}
