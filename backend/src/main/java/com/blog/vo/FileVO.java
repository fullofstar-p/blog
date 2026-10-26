package com.blog.vo;

import lombok.Data;

/**
 * 文件上传返回对象。
 */
@Data
public class FileVO {

    private String url;

    private String objectKey;

    private String originalName;

    private Long size;

    private String contentType;
}
