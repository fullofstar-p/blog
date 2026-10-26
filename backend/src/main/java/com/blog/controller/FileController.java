package com.blog.controller;

import com.blog.common.Result;
import com.blog.service.FileService;
import com.blog.vo.FileVO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * 文件接口：上传需登录，删除仅上传者或 ADMIN。
 */
@RestController
@RequestMapping("/api/files")
@RequiredArgsConstructor
public class FileController {

    private final FileService fileService;

    /**
     * 上传文件（multipart/form-data）。
     *
     * @param file     图片文件
     * @param category 业务分类：avatar / cover / content
     */
    @PostMapping("/upload")
    public Result<FileVO> upload(@RequestParam("file") MultipartFile file,
                                 @RequestParam(value = "category", defaultValue = "content") String category) {
        return Result.success(fileService.upload(file, category));
    }

    /** 删除文件（上传者或 ADMIN） */
    @DeleteMapping("/{objectKey}")
    public Result<Void> delete(@PathVariable String objectKey) {
        fileService.delete(objectKey);
        return Result.success();
    }
}
