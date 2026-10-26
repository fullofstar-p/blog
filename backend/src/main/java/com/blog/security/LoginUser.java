package com.blog.security;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.io.Serializable;

/**
 * 登录用户上下文（由 JWT 解析得到，放入 SecurityContext 的 principal）。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginUser implements Serializable {

    private static final long serialVersionUID = 1L;

    private Long id;

    private String username;

    /** ADMIN / USER */
    private String role;

    public boolean isAdmin() {
        return "ADMIN".equals(role);
    }
}
