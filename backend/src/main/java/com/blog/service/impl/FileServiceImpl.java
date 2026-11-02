package com.blog.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.blog.common.BusinessException;
import com.blog.common.ResultCode;
import com.blog.constant.FileConstants;
import com.blog.entity.FileObject;
import com.blog.mapper.FileObjectMapper;
import com.blog.security.LoginUser;
import com.blog.security.SecurityUtils;
import com.blog.service.FileService;
import com.blog.storage.FileStorageService;
import com.blog.storage.UploadedFile;
import com.blog.vo.FileVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

/**
 * 文件服务实现：上传写审计表，删除校验归属（上传者或 ADMIN）。
 */
@Service
@RequiredArgsConstructor
public class FileServiceImpl implements FileService {

    private final FileObjectMapper fileObjectMapper;
    private final FileStorageService fileStorageService;

    @Override
    @Transactional
    public FileVO upload(MultipartFile file, String category) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "请选择要上传的文件");
        }
        String cat = StringUtils.hasText(category) ? category.trim().toLowerCase() : FileConstants.DEFAULT_CATEGORY;
        if (!FileConstants.ALLOWED_CATEGORIES.contains(cat)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "上传分类不合法");
        }
        Long uploaderId = SecurityUtils.getUserId();
        UploadedFile uploaded = fileStorageService.upload(file, cat);

        FileObject entity = new FileObject();
        entity.setObjectKey(uploaded.getObjectKey());
        entity.setOriginalName(uploaded.getOriginalName());
        entity.setContentType(uploaded.getContentType());
        entity.setSize(uploaded.getSize());
        entity.setUploaderId(uploaderId);
        fileObjectMapper.insert(entity);

        FileVO vo = new FileVO();
        vo.setUrl(uploaded.getUrl());
        vo.setObjectKey(uploaded.getObjectKey());
        vo.setOriginalName(uploaded.getOriginalName());
        vo.setSize(uploaded.getSize());
        vo.setContentType(uploaded.getContentType());
        return vo;
    }

    @Override
    @Transactional
    public void delete(String objectKey) {
        if (!StringUtils.hasText(objectKey)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "objectKey 不能为空");
        }
        FileObject entity = fileObjectMapper.selectOne(
                new LambdaQueryWrapper<FileObject>().eq(FileObject::getObjectKey, objectKey));
        if (entity == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "文件不存在");
        }
        LoginUser loginUser = SecurityUtils.getLoginUser();
        boolean owner = entity.getUploaderId() != null && entity.getUploaderId().equals(loginUser.getId());
        if (!owner && !loginUser.isAdmin()) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权删除该文件");
        }
        fileStorageService.delete(objectKey);
        fileObjectMapper.deleteById(entity.getId());
    }
}
