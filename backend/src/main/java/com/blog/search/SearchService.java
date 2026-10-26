package com.blog.search;

import com.blog.common.PageResult;
import com.blog.vo.ArticleSummaryVO;

/**
 * 搜索服务抽象。
 *
 * <p>当前实现为 {@link com.blog.search.impl.MysqlSearchService}（LIKE + 权重排序）。</p>
 *
 * <p>扩展点：接入 Elasticsearch 时新增
 * {@code com.blog.search.impl.ElasticsearchSearchService implements SearchService}，
 * 通过 Spring 条件装配（如 {@code @ConditionalOnProperty(name = "search.engine", havingValue = "elasticsearch")}）
 * 切换实现即可，Controller / 前端契约保持不变。本次不实现。</p>
 */
public interface SearchService {

    /**
     * 搜索已发布文章。
     *
     * @param keyword  关键词（标题/摘要/正文/标签）
     * @param pageNum  页码，从 1 开始
     * @param pageSize 每页条数
     * @param sort     relevance（相关度，默认）| time（时间倒序）
     */
    PageResult<ArticleSummaryVO> search(String keyword, int pageNum, int pageSize, String sort);
}
