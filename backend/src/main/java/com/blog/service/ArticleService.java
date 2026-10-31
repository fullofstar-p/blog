package com.blog.service;

import com.blog.common.PageResult;
import com.blog.dto.ArticleSaveDTO;
import com.blog.vo.ArchiveVO;
import com.blog.vo.ArticleDetailVO;
import com.blog.vo.ArticleInteractionVO;
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

    /** 文章详情（阅读量 +1、PV/UV 统计，10 分钟缓存） */
    ArticleDetailVO detail(Long id, String visitorKey);

    /** 按年月归档 */
    List<ArchiveVO> archive();

    /** 文章互动状态（点赞/收藏） */
    ArticleInteractionVO interaction(Long id);

    /** 点赞（幂等），返回 { liked, likeCount } */
    java.util.Map<String, Object> like(Long id);

    /** 取消点赞（幂等），返回 { liked, likeCount } */
    java.util.Map<String, Object> unlike(Long id);

    /** 收藏（幂等），返回 { favorited, favoriteCount } */
    java.util.Map<String, Object> favorite(Long id);

    /** 取消收藏（幂等），返回 { favorited, favoriteCount } */
    java.util.Map<String, Object> unfavorite(Long id);

    /** 我的收藏分页 */
    PageResult<ArticleSummaryVO> myFavorites(int pageNum, int pageSize);

    /** 相关文章 */
    List<ArticleSummaryVO> related(Long id, int limit);

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

    /** 管理端删除文章（逻辑删除，进入回收站） */
    void adminDelete(Long id);

    /** 回收站分页 */
    PageResult<ArticleSummaryVO> recyclePage(int pageNum, int pageSize, String keyword);

    /** 从回收站恢复文章 */
    ArticleSummaryVO restore(Long id);

    /** 彻底删除回收站中的文章（不可恢复） */
    void purge(Long id);

    /** 批量置顶 / 取消置顶，返回受影响行数 */
    int batchUpdateTop(List<Long> ids, Integer isTop);

    /** 批量删除（进入回收站），返回受影响行数 */
    int batchDelete(List<Long> ids);

    /** 批量从回收站恢复，返回受影响行数 */
    int batchRestore(List<Long> ids);

    /** 批量彻底删除，返回受影响行数 */
    int batchPurge(List<Long> ids);
}
