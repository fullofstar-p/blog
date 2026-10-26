package com.blog.vo;

import lombok.Data;

import java.time.LocalDateTime;

/**
 * 用户视图对象。
 */
@Data
public class UserVO {

    private Long id;
    private String username;
    private String nickname;
    private String avatar;
    private String email;
    private String role;
    private Integer status;
    private LocalDateTime createTime;
}
