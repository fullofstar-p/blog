package com.blog.constant;

import java.util.Set;

/**
 * 文件上传常量：允许的分类、类型、后缀与大小上限。
 */
public final class FileConstants {

    private FileConstants() {
    }

    /** 允许的上传分类 */
    public static final Set<String> ALLOWED_CATEGORIES = Set.of("avatar", "cover", "content");

    /** 未指定分类时的默认分类 */
    public static final String DEFAULT_CATEGORY = "content";

    /** 允许的图片 MIME 类型 */
    public static final Set<String> ALLOWED_CONTENT_TYPES =
            Set.of("image/jpeg", "image/png", "image/webp", "image/gif");

    /** 允许的图片后缀 */
    public static final Set<String> ALLOWED_EXTENSIONS =
            Set.of("jpg", "jpeg", "png", "webp", "gif");

    /** 单文件大小上限：5MB */
    public static final long MAX_SIZE = 5L * 1024 * 1024;
}
