package com.blog.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;

import java.net.URI;

/**
 * 对象存储配置：使用 AWS SDK for Java v2 的 S3Client 访问 MinIO（S3 兼容 API）。
 * 只依赖 S3 协议，未来迁移到阿里云 OSS / AWS S3 只需改配置。
 */
@Configuration
public class S3Config {

    @Value("${minio.endpoint}")
    private String endpoint;

    @Value("${minio.region}")
    private String region;

    @Value("${minio.access-key}")
    private String accessKey;

    @Value("${minio.secret-key}")
    private String secretKey;

    @Bean(destroyMethod = "close")
    public S3Client s3Client() {
        // MinIO 需要 path-style 访问（http://endpoint/bucket/object）
        S3Configuration s3Configuration = S3Configuration.builder()
                .pathStyleAccessEnabled(true)
                .build();
        return S3Client.builder()
                .endpointOverride(URI.create(endpoint))
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKey, secretKey)))
                .serviceConfiguration(s3Configuration)
                .build();
    }
}
