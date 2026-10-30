package com.blog.mapper;

import com.blog.dto.ArticlePvRowDTO;
import com.blog.dto.DailyStatRowDTO;
import com.blog.dto.HeatmapRowDTO;
import com.blog.vo.TopArticleVO;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;
import java.util.List;

/**
 * 内容看板统计 Mapper：站点每日 PV/UV、文章每日阅读、发布热力图。
 */
public interface StatsMapper {

    /** 所有未删除文章的总阅读量 */
    long selectTotalViews();

    /** 区间内的站点每日统计 */
    List<DailyStatRowDTO> selectSiteDaily(@Param("start") LocalDate start, @Param("end") LocalDate end);

    /** 区间内按文章聚合的阅读量 */
    List<ArticlePvRowDTO> selectArticleDailyPv(@Param("start") LocalDate start, @Param("end") LocalDate end);

    /** 按总阅读量取热门文章（带分类/作者） */
    List<TopArticleVO> selectTopArticles(@Param("limit") int limit);

    /** 按区间阅读量取热门文章（带分类/作者） */
    List<TopArticleVO> selectTopArticlesByRange(@Param("start") LocalDate start,
                                                @Param("end") LocalDate end,
                                                @Param("limit") int limit);

    /** 区间内每天发布的文章数（已发布、未删除） */
    List<HeatmapRowDTO> selectPublishHeatmap(@Param("start") LocalDate start);

    /** 累加站点每日 PV，UV 取当日历史最大值（HyperLogLog 快照） */
    int upsertSiteDaily(@Param("date") LocalDate date, @Param("pv") long pv, @Param("uv") long uv);

    /** 累加文章每日阅读量 */
    int upsertArticleDaily(@Param("date") LocalDate date,
                           @Param("articleId") Long articleId,
                           @Param("pv") long pv);

    /** 彻底删除文章时清理其每日统计 */
    int deleteArticleDaily(@Param("articleId") Long articleId);

    /** 批量彻底删除时清理每日统计 */
    int deleteArticleDailyBatch(@Param("ids") List<Long> ids);
}
