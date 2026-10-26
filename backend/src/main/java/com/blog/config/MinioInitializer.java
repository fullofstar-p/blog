package com.blog.config;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.CreateBucketRequest;
import software.amazon.awssdk.services.s3.model.HeadBucketRequest;
import software.amazon.awssdk.services.s3.model.PutBucketPolicyRequest;
import software.amazon.awssdk.services.s3.model.S3Exception;

/**
 * MinIO bucket 初始化：启动时创建 bucket 并设置「公共读」策略。
 * docker-compose 中 backend 对 minio 只保证服务已启动（健康检查在部分镜像上不可用），
 * 因此这里必须带重试：最多 10 次、每次间隔 3 秒；全部失败只告警，不阻断应用启动。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class MinioInitializer implements ApplicationRunner {

    private static final int MAX_ATTEMPTS = 10;
    private static final long RETRY_INTERVAL_MS = 3000L;

    private final S3Client s3Client;

    @Value("${minio.bucket}")
    private String bucket;

    @Override
    public void run(ApplicationArguments args) {
        for (int attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
            try {
                ensureBucket();
                ensurePublicReadPolicy();
                log.info("MinIO bucket [{}] 初始化完成（公共读），尝试次数：{}", bucket, attempt);
                return;
            } catch (Exception e) {
                log.warn("MinIO bucket [{}] 初始化失败（第 {}/{} 次）：{}",
                        bucket, attempt, MAX_ATTEMPTS, e.getMessage());
                if (attempt < MAX_ATTEMPTS) {
                    try {
                        Thread.sleep(RETRY_INTERVAL_MS);
                    } catch (InterruptedException ie) {
                        Thread.currentThread().interrupt();
                        return;
                    }
                }
            }
        }
        log.warn("MinIO bucket [{}] 在 {} 次尝试后仍未初始化成功，应用继续启动（文件上传功能可能暂不可用）",
                bucket, MAX_ATTEMPTS);
    }

    /** 不存在则创建 bucket */
    private void ensureBucket() {
        try {
            s3Client.headBucket(HeadBucketRequest.builder().bucket(bucket).build());
        } catch (S3Exception e) {
            if (e.statusCode() == 404) {
                s3Client.createBucket(CreateBucketRequest.builder().bucket(bucket).build());
                log.info("MinIO bucket [{}] 已创建", bucket);
            } else {
                throw e;
            }
        }
    }

    /** 设置公共读策略（仅允许 s3:GetObject） */
    private void ensurePublicReadPolicy() {
        String policy = """
                {
                  "Version": "2012-10-17",
                  "Statement": [
                    {
                      "Effect": "Allow",
                      "Principal": {"AWS": ["*"]},
                      "Action": ["s3:GetObject"],
                      "Resource": ["arn:aws:s3:::%s/*"]
                    }
                  ]
                }
                """.formatted(bucket);
        s3Client.putBucketPolicy(PutBucketPolicyRequest.builder()
                .bucket(bucket)
                .policy(policy)
                .build());
    }
}
