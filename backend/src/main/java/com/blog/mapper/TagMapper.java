package com.blog.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.blog.entity.Tag;
import com.blog.vo.TagVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 标签 Mapper：列表联查已发布文章数。
 */
@Mapper
public interface TagMapper extends BaseMapper<Tag> {

    /**
     * 标签列表（含已发布文章数）。
     */
    @Select("SELECT t.id, t.name, " +
            "(SELECT COUNT(*) FROM article_tag at JOIN article a ON a.id = at.article_id AND a.status = 1 AND a.deleted = 0 WHERE at.tag_id = t.id) AS article_count " +
            "FROM tag t ORDER BY t.id ASC")
    List<TagVO> selectWithCount();
}
