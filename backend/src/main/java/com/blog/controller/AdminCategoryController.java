package com.blog.controller;

import com.blog.common.Result;
import com.blog.dto.CategorySaveDTO;
import com.blog.service.CategoryService;
import com.blog.vo.CategoryVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理端分类接口：/api/admin/categories（仅 ADMIN）。
 */
@RestController
@RequestMapping("/api/admin/categories")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminCategoryController {

    private final CategoryService categoryService;

    @PostMapping
    public Result<CategoryVO> create(@Valid @RequestBody CategorySaveDTO dto) {
        return Result.success(categoryService.create(dto));
    }

    @PutMapping("/{id}")
    public Result<CategoryVO> update(@PathVariable Long id,
                                     @Valid @RequestBody CategorySaveDTO dto) {
        return Result.success(categoryService.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        categoryService.delete(id);
        return Result.success();
    }
}
