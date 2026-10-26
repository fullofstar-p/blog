package com.blog.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import org.springdoc.core.models.GroupedOpenApi;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Knife4j / SpringDoc 接口文档配置：访问 /doc.html。
 */
@Configuration
public class Knife4jConfig {

    private static final String SECURITY_SCHEME_NAME = "BearerAuth";

    @Bean
    public OpenAPI blogOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("技术分享博客 API")
                        .description("博客系统 RESTful 接口文档（统一响应体 { code, message, data }）")
                        .version("1.0.0"))
                .components(new Components().addSecuritySchemes(SECURITY_SCHEME_NAME,
                        new SecurityScheme()
                                .type(SecurityScheme.Type.HTTP)
                                .scheme("bearer")
                                .bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList(SECURITY_SCHEME_NAME));
    }

    @Bean
    public GroupedOpenApi blogApi() {
        return GroupedOpenApi.builder()
                .group("blog")
                .pathsToMatch("/api/**")
                .build();
    }
}
