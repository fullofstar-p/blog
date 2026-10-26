package com.blog.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.blog.entity.Category;
import com.blog.vo.CategoryVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 分类 Mapper：列表联查已发布文章数。
 */
@Mapper
public interface CategoryMapper extends BaseMapper<Category> {

    /**
     * 分类列表（含已发布文章数），按 sort 升序。
     */
    @Select("SELECT c.id, c.name, c.sort, " +
            "(SELECT COUNT(*) FROM article a WHERE a.category_id = c.id AND a.status = 1 AND a.deleted = 0) AS article_count " +
            "FROM category c ORDER BY c.sort ASC, c.id ASC")
    List<CategoryVO> selectWithCount();
}
