package com.blog.controller;

import com.blog.common.Result;
import com.blog.dto.CommentCreateDTO;
import com.blog.service.CommentService;
import com.blog.vo.CommentVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/**
 * 评论接口：公开评论列表 + 登录后发表/删除/点赞。
 */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class CommentController {

    private final CommentService commentService;

    /** 某篇文章下已通过的评论树（公开） */
    @GetMapping("/articles/{articleId}/comments")
    public Result<List<CommentVO>> listByArticle(@PathVariable Long articleId) {
        return Result.success(commentService.listByArticle(articleId));
    }

    /** 发表评论（待审核） */
    @PostMapping("/comments")
    public Result<CommentVO> create(@Valid @RequestBody CommentCreateDTO dto) {
        return Result.success(commentService.create(dto));
    }

    /** 删除评论（本人或 ADMIN） */
    @DeleteMapping("/comments/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        commentService.delete(id);
        return Result.success();
    }

    /** 点赞（返回最新点赞状态与数量） */
    @PostMapping("/comments/{id}/like")
    public Result<Map<String, Object>> like(@PathVariable Long id) {
        return Result.success(commentService.like(id));
    }

    /** 取消点赞（幂等，返回最新点赞状态与数量） */
    @DeleteMapping("/comments/{id}/like")
    public Result<Map<String, Object>> unlike(@PathVariable Long id) {
        return Result.success(commentService.unlike(id));
    }
}
