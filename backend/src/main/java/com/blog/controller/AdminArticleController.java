package com.blog.controller;

import com.blog.common.PageResult;
import com.blog.common.Result;
import com.blog.dto.TopDTO;
import com.blog.service.ArticleService;
import com.blog.vo.ArticleSummaryVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理端文章接口：/api/admin/articles（仅 ADMIN）。
 */
@RestController
@RequestMapping("/api/admin/articles")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminArticleController {

    private final ArticleService articleService;

    @GetMapping
    public Result<PageResult<ArticleSummaryVO>> list(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) Integer status,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Long categoryId) {
        return Result.success(articleService.adminPage(pageNum, pageSize, status, keyword, categoryId));
    }

    @PutMapping("/{id}/top")
    public Result<Void> updateTop(@PathVariable Long id, @Valid @RequestBody TopDTO dto) {
        articleService.updateTop(id, dto.getIsTop());
        return Result.success();
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        articleService.adminDelete(id);
        return Result.success();
    }
}
