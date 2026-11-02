package com.blog.constant;

/**
 * 认证与授权常量：角色、权限表达式与 token 前缀。
 */
public final class SecurityConstants {

    private SecurityConstants() {
    }

    /** Spring Security 角色前缀 */
    public static final String ROLE_PREFIX = "ROLE_";

    /** 管理员角色 */
    public static final String ROLE_ADMIN = "ADMIN";

    /** 普通用户角色 */
    public static final String ROLE_USER = "USER";

    /** 角色校验用的正则，与 {@code UserRoleDTO} 保持一致 */
    public static final String ROLE_PATTERN = "^(" + ROLE_ADMIN + "|" + ROLE_USER + ")$";

    /** 管理端接口的权限表达式，供 {@code @PreAuthorize} 复用 */
    public static final String HAS_ROLE_ADMIN = "hasRole('" + ROLE_ADMIN + "')";

    /** Authorization 请求头中的 token 前缀 */
    public static final String BEARER_PREFIX = "Bearer ";

    /** token 类型：访问令牌 */
    public static final String TOKEN_TYPE_ACCESS = "access";

    /** token 类型：刷新令牌 */
    public static final String TOKEN_TYPE_REFRESH = "refresh";
}
