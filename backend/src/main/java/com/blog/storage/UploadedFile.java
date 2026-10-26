package com.blog.storage;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 文件上传结果。
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UploadedFile {

    /** 对象键：{category}-{uuid}.{ext}，不含路径分隔符 */
    private String objectKey;

    private String originalName;

    private String contentType;

    private Long size;

    /** 浏览器可访问的 URL（public-endpoint + bucket + objectKey） */
    private String url;
}
