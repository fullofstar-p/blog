package com.blog.controller;

import com.blog.common.PageResult;
import com.blog.common.Result;
import com.blog.service.ArticleService;
import com.blog.vo.ArticleSummaryVO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 我的收藏接口：/api/favorites（需登录）。
 */
@RestController
@RequestMapping("/api/favorites")
@RequiredArgsConstructor
public class FavoriteController {

    private final ArticleService articleService;

    /** 我的收藏分页（按收藏时间倒序） */
    @GetMapping
    public Result<PageResult<ArticleSummaryVO>> list(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize) {
        return Result.success(articleService.myFavorites(pageNum, pageSize));
    }
}
