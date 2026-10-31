package com.blog.mapper;

import com.blog.entity.ArticleTag;
import org.apache.ibatis.annotations.Delete;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 文章-标签关联 Mapper。
 *
 * <p>{@code article_tag} 使用联合主键 {@code (article_id, tag_id)}，而 MyBatis-Plus 只支持单一主键，
 * 因此这里不继承 {@code BaseMapper}，改用显式 SQL 维护关联关系。
 * 这样启动时就不会再出现 “Can not find table primary key in Class: ArticleTag” 的 WARN，
 * 也不会生成语义错误的 {@code xxById} 方法。</p>
 */
@Mapper
public interface ArticleTagMapper {

    /** 写入一条文章-标签关联 */
    @Insert("INSERT INTO article_tag (article_id, tag_id) VALUES (#{articleId}, #{tagId})")
    int insert(ArticleTag articleTag);

    /** 删除某篇文章的全部标签关联 */
    @Delete("DELETE FROM article_tag WHERE article_id = #{articleId}")
    int deleteByArticleId(@Param("articleId") Long articleId);

    /** 批量删除多篇文章的标签关联 */
    @Delete("""
            <script>
            DELETE FROM article_tag WHERE article_id IN
            <foreach collection="articleIds" item="articleId" open="(" separator="," close=")">
                #{articleId}
            </foreach>
            </script>
            """)
    int deleteByArticleIds(@Param("articleIds") List<Long> articleIds);

    /** 删除某个标签的全部文章关联 */
    @Delete("DELETE FROM article_tag WHERE tag_id = #{tagId}")
    int deleteByTagId(@Param("tagId") Long tagId);

    /** 统计某个标签关联的文章数 */
    @Select("SELECT COUNT(*) FROM article_tag WHERE tag_id = #{tagId}")
    long countByTagId(@Param("tagId") Long tagId);
}
