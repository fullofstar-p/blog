package com.blog.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 文章表实体（逻辑删除）。
 */
@Data
@TableName("article")
public class Article {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String title;

    private String summary;

    /** Markdown 正文 */
    private String content;

    /** 封面图 URL（MinIO） */
    private String cover;

    private Long categoryId;

    private Long authorId;

    /** 状态：0 草稿 / 1 已发布 */
    private Integer status;

    /** 是否置顶：0 否 / 1 是 */
    private Integer isTop;

    private Integer viewCount;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;

    /** 逻辑删除：0 正常 / 1 已删除 */
    @TableLogic
    @TableField(select = false)
    private Integer deleted;
}
