package com.blog.storage;

import com.blog.common.BusinessException;
import com.blog.common.ResultCode;
import com.blog.constant.FileConstants;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.DeleteObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.InputStream;
import java.util.Locale;
import java.util.UUID;

/**
 * MinIO 文件存储实现：基于 AWS SDK for Java v2 的 S3Client（S3 兼容 API）。
 * bucket 公共读，objectKey 扁平随机生成，防止遍历。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MinioFileStorageService implements FileStorageService {

    private final S3Client s3Client;

    @Value("${minio.bucket}")
    private String bucket;

    @Value("${minio.public-endpoint}")
    private String publicEndpoint;

    @Override
    public UploadedFile upload(MultipartFile file, String category) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "请选择要上传的文件");
        }
        String cat = StringUtils.hasText(category) ? category.trim().toLowerCase(Locale.ROOT) : "";
        if (!FileConstants.ALLOWED_CATEGORIES.contains(cat)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "上传分类不合法");
        }
        if (file.getSize() > FileConstants.MAX_SIZE) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "文件大小不能超过 5MB");
        }
        String contentType = file.getContentType() == null
                ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        String extension = resolveExtension(file.getOriginalFilename());
        if (!FileConstants.ALLOWED_CONTENT_TYPES.contains(contentType)
                || !FileConstants.ALLOWED_EXTENSIONS.contains(extension)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "仅支持 jpg/png/webp/gif 图片");
        }

        String objectKey = cat + "-" + UUID.randomUUID().toString().replace("-", "") + "." + extension;
        try (InputStream inputStream = file.getInputStream()) {
            PutObjectRequest request = PutObjectRequest.builder()
                    .bucket(bucket)
                    .key(objectKey)
                    .contentType(contentType)
                    .contentLength(file.getSize())
                    .build();
            s3Client.putObject(request, RequestBody.fromInputStream(inputStream, file.getSize()));
        } catch (Exception e) {
            log.error("上传文件到 MinIO 失败，objectKey={}", objectKey, e);
            throw new BusinessException(ResultCode.ERROR, "文件上传失败，请稍后重试");
        }

        return UploadedFile.builder()
                .objectKey(objectKey)
                .originalName(file.getOriginalFilename())
                .contentType(contentType)
                .size(file.getSize())
                .url(buildUrl(objectKey))
                .build();
    }

    @Override
    public void delete(String objectKey) {
        if (!StringUtils.hasText(objectKey)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "objectKey 不能为空");
        }
        try {
            s3Client.deleteObject(DeleteObjectRequest.builder()
                    .bucket(bucket)
                    .key(objectKey)
                    .build());
        } catch (Exception e) {
            log.error("删除 MinIO 对象失败，objectKey={}", objectKey, e);
            throw new BusinessException(ResultCode.ERROR, "文件删除失败，请稍后重试");
        }
    }

    @Override
    public String buildUrl(String objectKey) {
        String base = publicEndpoint == null ? "" : publicEndpoint.trim();
        while (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base + "/" + bucket + "/" + objectKey;
    }

    /** 提取并校验后缀名 */
    private String resolveExtension(String originalFilename) {
        if (!StringUtils.hasText(originalFilename)) {
            return "";
        }
        int dotIndex = originalFilename.lastIndexOf('.');
        if (dotIndex < 0 || dotIndex == originalFilename.length() - 1) {
            return "";
        }
        return originalFilename.substring(dotIndex + 1).toLowerCase(Locale.ROOT);
    }
}
