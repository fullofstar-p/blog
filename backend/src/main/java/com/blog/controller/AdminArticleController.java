package com.blog.controller;

import com.blog.common.PageResult;
import com.blog.common.Result;
import com.blog.constant.SecurityConstants;
import com.blog.dto.BatchIdsDTO;
import com.blog.dto.BatchTopDTO;
import com.blog.dto.TopDTO;
import com.blog.service.ArticleService;
import com.blog.vo.ArticleSummaryVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
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
@PreAuthorize(SecurityConstants.HAS_ROLE_ADMIN)
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

    /** 回收站分页 */
    @GetMapping("/recycle")
    public Result<PageResult<ArticleSummaryVO>> recycle(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String keyword) {
        return Result.success(articleService.recyclePage(pageNum, pageSize, keyword));
    }

    /** 从回收站恢复文章 */
    @PutMapping("/{id}/restore")
    public Result<ArticleSummaryVO> restore(@PathVariable Long id) {
        return Result.success(articleService.restore(id));
    }

    /** 彻底删除回收站中的文章（不可恢复） */
    @DeleteMapping("/{id}/purge")
    public Result<Void> purge(@PathVariable Long id) {
        articleService.purge(id);
        return Result.success();
    }

    /** 批量置顶 / 取消置顶 */
    @PutMapping("/batch/top")
    public Result<Integer> batchTop(@Valid @RequestBody BatchTopDTO dto) {
        return Result.success(articleService.batchUpdateTop(dto.getIds(), dto.getIsTop()));
    }

    /** 批量删除（进入回收站） */
    @PostMapping("/batch/delete")
    public Result<Integer> batchDelete(@Valid @RequestBody BatchIdsDTO dto) {
        return Result.success(articleService.batchDelete(dto.getIds()));
    }

    /** 批量从回收站恢复 */
    @PostMapping("/batch/restore")
    public Result<Integer> batchRestore(@Valid @RequestBody BatchIdsDTO dto) {
        return Result.success(articleService.batchRestore(dto.getIds()));
    }

    /** 批量彻底删除 */
    @PostMapping("/batch/purge")
    public Result<Integer> batchPurge(@Valid @RequestBody BatchIdsDTO dto) {
        return Result.success(articleService.batchPurge(dto.getIds()));
    }
}
