package com.blog.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 文章点赞表实体（article_id + user_id 唯一）。
 */
@Data
@TableName("article_like")
public class ArticleLike {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long articleId;

    private Long userId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
