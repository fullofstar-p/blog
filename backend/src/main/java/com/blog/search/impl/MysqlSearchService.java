package com.blog.search.impl;

import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.blog.common.PageResult;
import com.blog.constant.PageConstants;
import com.blog.mapper.ArticleMapper;
import com.blog.search.SearchService;
import com.blog.service.ArticleTagAssembler;
import com.blog.vo.ArticleSummaryVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;

/**
 * MySQL LIKE 搜索实现（起步方案）。
 * 匹配标题/摘要/正文/标签，相关度权重：标题 5、摘要 3、标签 2、正文 1。
 *
 * <p>总数单独用 {@code selectSearchCount} 统计，避免分页插件把带相关度计算的
 * 复杂 SQL 包成 {@code SELECT COUNT(*) FROM (…)} 全量执行。</p>
 */
@Service
@RequiredArgsConstructor
public class MysqlSearchService implements SearchService {

    private final ArticleMapper articleMapper;
    private final ArticleTagAssembler articleTagAssembler;

    @Override
    public PageResult<ArticleSummaryVO> search(String keyword, int pageNum, int pageSize, String sort) {
        int current = Math.max(PageConstants.MIN_PAGE_NUM, pageNum);
        int size = Math.min(Math.max(PageConstants.MIN_PAGE_SIZE, pageSize), PageConstants.MAX_PAGE_SIZE);
        if (!StringUtils.hasText(keyword)) {
            return PageResult.of(new ArrayList<>(), 0, current, size);
        }
        String order = "time".equalsIgnoreCase(sort) ? "time" : "relevance";
        String kw = keyword.trim();
        long total = articleMapper.selectSearchCount(kw);
        Page<ArticleSummaryVO> page = new Page<>(current, size);
        page.setSearchCount(false);
        page.setTotal(total);
        IPage<ArticleSummaryVO> result = articleMapper.selectSearchPage(page, kw, order);
        articleTagAssembler.fill(result.getRecords());
        return PageResult.of(result);
    }
}
