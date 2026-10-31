package com.blog.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.blog.entity.ArticleLike;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * 文章点赞 Mapper。
 */
@Mapper
public interface ArticleLikeMapper extends BaseMapper<ArticleLike> {

    /**
     * 幂等点赞：依赖唯一键 {@code uk_article_like}，返回实际插入行数（0 表示已点过）。
     */
    @Insert("INSERT IGNORE INTO article_like (article_id, user_id) VALUES (#{articleId}, #{userId})")
    int insertIgnore(@Param("articleId") Long articleId, @Param("userId") Long userId);
}
