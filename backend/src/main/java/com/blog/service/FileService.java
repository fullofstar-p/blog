package com.blog.service;

import com.blog.vo.FileVO;
import org.springframework.web.multipart.MultipartFile;

/**
 * 文件服务：上传审计 + 删除归属校验。
 */
public interface FileService {

    /** 上传文件，返回访问 URL 与 objectKey */
    FileVO upload(MultipartFile file, String category);

    /** 删除文件（上传者或 ADMIN） */
    void delete(String objectKey);
}
