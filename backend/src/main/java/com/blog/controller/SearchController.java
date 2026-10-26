package com.blog.controller;

import com.blog.common.PageResult;
import com.blog.common.Result;
import com.blog.search.SearchService;
import com.blog.vo.ArticleSummaryVO;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 搜索接口：GET /api/search（公开）。
 */
@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    @GetMapping
    public Result<PageResult<ArticleSummaryVO>> search(
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String sort) {
        return Result.success(searchService.search(keyword, pageNum, pageSize, sort));
    }
}
