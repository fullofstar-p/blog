package com.blog.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.blog.dto.ArchiveRowDTO;
import com.blog.dto.ArticleTagRowDTO;
import com.blog.entity.Article;
import com.blog.vo.ArticleDetailVO;
import com.blog.vo.ArticleNavVO;
import com.blog.vo.ArticleSummaryVO;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 文章 Mapper：复杂联表查询在 resources/mapper/ArticleMapper.xml 中实现。
 */
public interface ArticleMapper extends BaseMapper<Article> {

    /**
     * 分页查询文章摘要（列表 / 我的文章 / 管理端共用）。
     */
    IPage<ArticleSummaryVO> selectSummaryPage(IPage<ArticleSummaryVO> page,
                                              @Param("keyword") String keyword,
                                              @Param("categoryId") Long categoryId,
                                              @Param("tagId") Long tagId,
                                              @Param("authorId") Long authorId,
                                              @Param("status") Integer status,
                                              @Param("year") Integer year,
                                              @Param("month") Integer month,
                                              @Param("sort") String sort,
                                              @Param("pinFirst") boolean pinFirst);

    /**
     * 搜索分页（标题/摘要/正文/标签，按相关度或时间排序）。
     */
    IPage<ArticleSummaryVO> selectSearchPage(IPage<ArticleSummaryVO> page,
                                             @Param("keyword") String keyword,
                                             @Param("sort") String sort);

    /**
     * 列表总数（与 {@link #selectSummaryPage} 同一套筛选条件）。
     *
     * <p>单独一条 COUNT，避免分页插件对复杂 SQL 回退成
     * {@code SELECT COUNT(*) FROM (整段列表查询)}，导致每次翻页都全量计算。</p>
     */
    long selectSummaryCount(@Param("keyword") String keyword,
                            @Param("categoryId") Long categoryId,
                            @Param("tagId") Long tagId,
                            @Param("authorId") Long authorId,
                            @Param("status") Integer status,
                            @Param("year") Integer year,
                            @Param("month") Integer month);

    /**
     * 搜索结果总数（与 {@link #selectSearchPage} 同一套匹配条件）。
     */
    long selectSearchCount(@Param("keyword") String keyword);

    /**
     * 按文章 ID 批量查询标签（含标签的已发布文章数）。
     */
    List<ArticleTagRowDTO> selectTagsByArticleIds(@Param("articleIds") List<Long> articleIds);

    /**
     * 置顶文章列表。
     */
    List<ArticleSummaryVO> selectTop(@Param("limit") int limit);

    /**
     * 文章详情（含正文，关联分类/作者/标签）。
     */
    ArticleDetailVO selectDetailById(@Param("id") Long id);

    /**
     * 文章摘要（创建/更新后回显）。
     */
    ArticleSummaryVO selectSummaryById(@Param("id") Long id);

    /**
     * 上一篇（id 更小、已发布）。
     */
    ArticleNavVO selectPrevArticle(@Param("id") Long id);

    /**
     * 下一篇（id 更大、已发布）。
     */
    ArticleNavVO selectNextArticle(@Param("id") Long id);

    /**
     * 仅查询阅读量：详情命中缓存时用于合并 Redis 增量，避免缓存里的旧值让阅读量回跳。
     */
    Integer selectViewCountById(@Param("id") Long id);

    /**
     * 按年月归档统计。
     */
    List<ArchiveRowDTO> selectArchive();
}
