package com.blog.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.blog.entity.ArticleFavorite;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * 文章收藏 Mapper。
 */
@Mapper
public interface ArticleFavoriteMapper extends BaseMapper<ArticleFavorite> {

    /**
     * 幂等收藏：依赖唯一键 {@code uk_article_favorite}，返回实际插入行数（0 表示已收藏）。
     */
    @Insert("INSERT IGNORE INTO article_favorite (article_id, user_id) VALUES (#{articleId}, #{userId})")
    int insertIgnore(@Param("articleId") Long articleId, @Param("userId") Long userId);
}
