package com.blog.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 评论表实体（两级评论：parent_id 为空表示一级评论）。
 */
@Data
@TableName("comment")
public class Comment {

    @TableId(type = IdType.AUTO)
    private Long id;

    private Long articleId;

    private Long userId;

    /** 父评论 ID，NULL 表示一级评论 */
    private Long parentId;

    /** 楼中楼根评论 ID：根评论为自身 id */
    private Long rootId;

    /** 被回复的用户 ID：根评论为 NULL */
    private Long replyToUserId;

    /** 嵌套层级：0 为一级，最多 4（共 5 层） */
    private Integer depth;

    private String content;

    /** 状态：0 待审核 / 1 通过 / 2 拒绝 */
    private Integer status;

    private Integer likeCount;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
