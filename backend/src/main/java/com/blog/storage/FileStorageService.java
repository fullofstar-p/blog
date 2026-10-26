package com.blog.storage;

import org.springframework.web.multipart.MultipartFile;

/**
 * 文件存储抽象：默认实现为 MinIO（S3 兼容），未来可替换为 OSS/S3 等实现。
 */
public interface FileStorageService {

    /**
     * 上传文件。
     *
     * @param file     上传文件
     * @param category 业务分类：avatar / cover / content
     */
    UploadedFile upload(MultipartFile file, String category);

    /**
     * 删除对象。
     */
    void delete(String objectKey);

    /**
     * 拼接对象公网访问 URL。
     */
    String buildUrl(String objectKey);
}
