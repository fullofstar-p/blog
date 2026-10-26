package com.blog.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.blog.common.BusinessException;
import com.blog.common.ResultCode;
import com.blog.dto.CategorySaveDTO;
import com.blog.entity.Article;
import com.blog.entity.Category;
import com.blog.mapper.ArticleMapper;
import com.blog.mapper.CategoryMapper;
import com.blog.service.CategoryService;
import com.blog.vo.CategoryVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

/**
 * 分类服务实现。
 */
@Service
@RequiredArgsConstructor
public class CategoryServiceImpl implements CategoryService {

    private final CategoryMapper categoryMapper;
    private final ArticleMapper articleMapper;

    @Override
    public List<CategoryVO> list() {
        return categoryMapper.selectWithCount();
    }

    @Override
    @Transactional
    public CategoryVO create(CategorySaveDTO dto) {
        checkNameUnique(dto.getName(), null);
        Category category = new Category();
        category.setName(dto.getName().trim());
        category.setSort(dto.getSort() == null ? 0 : dto.getSort());
        categoryMapper.insert(category);
        return toVO(category, 0);
    }

    @Override
    @Transactional
    public CategoryVO update(Long id, CategorySaveDTO dto) {
        Category category = categoryMapper.selectById(id);
        if (category == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "分类不存在");
        }
        checkNameUnique(dto.getName(), id);
        category.setName(dto.getName().trim());
        if (dto.getSort() != null) {
            category.setSort(dto.getSort());
        }
        categoryMapper.updateById(category);
        return toVO(category, countArticles(id));
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Category category = categoryMapper.selectById(id);
        if (category == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "分类不存在");
        }
        if (countArticles(id) > 0) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "该分类下存在文章，无法删除");
        }
        categoryMapper.deleteById(id);
    }

    private void checkNameUnique(String name, Long excludeId) {
        LambdaQueryWrapper<Category> wrapper = new LambdaQueryWrapper<Category>()
                .eq(Category::getName, name.trim());
        if (excludeId != null) {
            wrapper.ne(Category::getId, excludeId);
        }
        if (categoryMapper.selectCount(wrapper) > 0) {
            throw new BusinessException(ResultCode.CONFLICT, "分类名已存在");
        }
    }

    private int countArticles(Long categoryId) {
        Long count = articleMapper.selectCount(
                new LambdaQueryWrapper<Article>().eq(Article::getCategoryId, categoryId));
        return count == null ? 0 : count.intValue();
    }

    private CategoryVO toVO(Category category, int articleCount) {
        CategoryVO vo = new CategoryVO();
        vo.setId(category.getId());
        vo.setName(category.getName());
        vo.setSort(category.getSort());
        vo.setArticleCount(articleCount);
        return vo;
    }
}
