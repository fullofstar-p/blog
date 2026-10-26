package com.blog.service;

import com.blog.common.PageResult;
import com.blog.dto.ArticleSaveDTO;
import com.blog.vo.ArchiveVO;
import com.blog.vo.ArticleDetailVO;
import com.blog.vo.ArticleSummaryVO;

import java.util.List;

/**
 * 文章服务。
 */
public interface ArticleService {

    /** 公开文章分页列表 */
    PageResult<ArticleSummaryVO> list(int pageNum, int pageSize, Long categoryId, Long tagId,
                                      String keyword, Integer year, Integer month, String sort);

    /** 置顶文章列表 */
    List<ArticleSummaryVO> top(int limit);

    /** 文章详情（阅读量 +1，10 分钟缓存） */
    ArticleDetailVO detail(Long id);

    /** 按年月归档 */
    List<ArchiveVO> archive();

    /** 我的文章（含草稿） */
    PageResult<ArticleSummaryVO> mine(int pageNum, int pageSize, Integer status);

    /** 新建文章 */
    ArticleSummaryVO create(ArticleSaveDTO dto);

    /** 更新文章（作者或 ADMIN） */
    ArticleSummaryVO update(Long id, ArticleSaveDTO dto);

    /** 删除文章（逻辑删除，作者或 ADMIN） */
    void delete(Long id);

    /** 管理端文章分页 */
    PageResult<ArticleSummaryVO> adminPage(int pageNum, int pageSize, Integer status,
                                           String keyword, Long categoryId);

    /** 管理端置顶/取消置顶 */
    void updateTop(Long id, Integer isTop);

    /** 管理端删除文章 */
    void adminDelete(Long id);
}
