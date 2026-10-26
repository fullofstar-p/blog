package com.blog.service;

import com.blog.dto.CategorySaveDTO;
import com.blog.vo.CategoryVO;

import java.util.List;

/**
 * 分类服务。
 */
public interface CategoryService {

    /** 分类列表（含已发布文章数） */
    List<CategoryVO> list();

    /** 新增分类 */
    CategoryVO create(CategorySaveDTO dto);

    /** 更新分类 */
    CategoryVO update(Long id, CategorySaveDTO dto);

    /** 删除分类（有文章引用时拒绝） */
    void delete(Long id);
}
