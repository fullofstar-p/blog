package com.blog.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 用户表实体（表名 user 为 MySQL 非保留字，这里加反引号更稳妥）。
 */
@Data
@TableName("`user`")
public class User {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 登录名（唯一） */
    private String username;

    /** BCrypt 密码哈希 */
    private String password;

    private String nickname;

    /** 头像 URL（MinIO） */
    private String avatar;

    private String email;

    /** 角色：ADMIN / USER */
    private String role;

    /** 状态：1 启用 / 0 禁用 */
    private Integer status;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
