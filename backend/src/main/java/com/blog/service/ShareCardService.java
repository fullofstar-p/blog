package com.blog.service;

/**
 * 分享卡片服务：服务端用 Java2D 生成 PNG。
 */
public interface ShareCardService {

    /**
     * 生成文章分享卡片（1200×630 PNG）。
     *
     * @throws com.blog.common.BusinessException 文章不存在或未发布时抛 404
     */
    byte[] render(Long articleId);
}
