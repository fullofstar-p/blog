package com.blog.controller;

import com.blog.common.Result;
import com.blog.dto.TagSaveDTO;
import com.blog.service.TagService;
import com.blog.vo.TagVO;
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
 * 管理端标签接口：/api/admin/tags（仅 ADMIN）。
 */
@RestController
@RequestMapping("/api/admin/tags")
@PreAuthorize("hasRole('ADMIN')")
@RequiredArgsConstructor
public class AdminTagController {

    private final TagService tagService;

    @PostMapping
    public Result<TagVO> create(@Valid @RequestBody TagSaveDTO dto) {
        return Result.success(tagService.create(dto));
    }

    @PutMapping("/{id}")
    public Result<TagVO> update(@PathVariable Long id,
                                @Valid @RequestBody TagSaveDTO dto) {
        return Result.success(tagService.update(id, dto));
    }

    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        tagService.delete(id);
        return Result.success();
    }
}
