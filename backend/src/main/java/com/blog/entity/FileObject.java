package com.blog.entity;

import com.baomidou.mybatisplus.annotation.FieldFill;
import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * 文件对象审计表实体：记录上传归属，支撑删除鉴权。
 */
@Data
@TableName("file_object")
public class FileObject {

    @TableId(type = IdType.AUTO)
    private Long id;

    private String objectKey;

    private String originalName;

    private String contentType;

    private Long size;

    private Long uploaderId;

    @TableField(fill = FieldFill.INSERT)
    private LocalDateTime createTime;
}
