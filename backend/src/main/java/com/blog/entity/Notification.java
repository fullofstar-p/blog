package com.blog.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 站内通知实体。
 */
@Data
@TableName("notification")
public class Notification {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 接收人 ID */
    private Long userId;

    /** COMMENT / REPLY / COMMENT_AUDIT */
    private String type;

    private String title;

    /** 内容摘要 */
    private String content;

    private Long articleId;

    private Long commentId;

    /** 触发人 ID */
    private Long senderId;

    /** 0 未读 / 1 已读 */
    private Integer isRead;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
