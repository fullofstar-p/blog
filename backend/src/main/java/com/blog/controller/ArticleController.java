package com.blog.controller;

import com.blog.common.PageResult;
import com.blog.common.BusinessException;
import com.blog.common.Result;
import com.blog.dto.ArticleSaveDTO;
import com.blog.security.VisitorKeys;
import com.blog.service.ArticleService;
import com.blog.service.ShareCardService;
import com.blog.vo.ArchiveVO;
import com.blog.vo.ArticleDetailVO;
import com.blog.vo.ArticleInteractionVO;
import com.blog.vo.ArticleSummaryVO;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;
import java.util.List;
import java.util.Map;

/**
 * 文章接口：/api/articles。
 * 公开读接口在 SecurityConfig 中放行；写操作由 Service 校验作者或 ADMIN。
 */
@RestController
@RequestMapping("/api/articles")
@RequiredArgsConstructor
public class ArticleController {

    private final ArticleService articleService;
    private final ShareCardService shareCardService;

    /** 公开文章列表 */
    @GetMapping
    public Result<PageResult<ArticleSummaryVO>> list(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) Long categoryId,
            @RequestParam(required = false) Long tagId,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) Integer year,
            @RequestParam(required = false) Integer month,
            @RequestParam(required = false) String sort) {
        return Result.success(articleService.list(pageNum, pageSize, categoryId, tagId,
                keyword, year, month, sort));
    }

    /** 置顶文章 */
    @GetMapping("/top")
    public Result<List<ArticleSummaryVO>> top(@RequestParam(defaultValue = "5") int limit) {
        return Result.success(articleService.top(limit));
    }

    /** 文章详情（阅读量 +1，并记录 PV/UV） */
    @GetMapping("/{id}")
    public Result<ArticleDetailVO> detail(@PathVariable Long id, HttpServletRequest request) {
        return Result.success(articleService.detail(id, VisitorKeys.of(request)));
    }

    /** 文章互动状态（点赞/收藏；未登录 liked/favorited 为 false） */
    @GetMapping("/{id}/interaction")
    public Result<ArticleInteractionVO> interaction(@PathVariable Long id) {
        return Result.success(articleService.interaction(id));
    }

    /** 相关文章（共同标签 * 3 + 同分类 + 2） */
    @GetMapping("/{id}/related")
    public Result<List<ArticleSummaryVO>> related(@PathVariable Long id,
                                                  @RequestParam(defaultValue = "6") int limit) {
        return Result.success(articleService.related(id, limit));
    }

    /** 点赞（幂等） */
    @PostMapping("/{id}/like")
    public Result<Map<String, Object>> like(@PathVariable Long id) {
        return Result.success(articleService.like(id));
    }

    /** 取消点赞（幂等） */
    @DeleteMapping("/{id}/like")
    public Result<Map<String, Object>> unlike(@PathVariable Long id) {
        return Result.success(articleService.unlike(id));
    }

    /** 收藏（幂等） */
    @PostMapping("/{id}/favorite")
    public Result<Map<String, Object>> favorite(@PathVariable Long id) {
        return Result.success(articleService.favorite(id));
    }

    /** 取消收藏（幂等） */
    @DeleteMapping("/{id}/favorite")
    public Result<Map<String, Object>> unfavorite(@PathVariable Long id) {
        return Result.success(articleService.unfavorite(id));
    }

    /** 分享卡片 PNG（公开，1200×630，缓存 1 小时；文章不存在/未发布返回空 404） */
    @GetMapping(value = "/{id}/share-card.png", produces = MediaType.IMAGE_PNG_VALUE)
    public ResponseEntity<byte[]> shareCard(@PathVariable Long id) {
        byte[] png;
        try {
            png = shareCardService.render(id);
        } catch (BusinessException e) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok()
                .contentType(MediaType.IMAGE_PNG)
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                .body(png);
    }

    /** 按年月归档 */
    @GetMapping("/archive")
    public Result<List<ArchiveVO>> archive() {
        return Result.success(articleService.archive());
    }

    /** 我的文章 */
    @GetMapping("/mine")
    public Result<PageResult<ArticleSummaryVO>> mine(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) Integer status) {
        return Result.success(articleService.mine(pageNum, pageSize, status));
    }

    /** 新建文章 */
    @PostMapping
    public Result<ArticleSummaryVO> create(@Valid @RequestBody ArticleSaveDTO dto) {
        return Result.success(articleService.create(dto));
    }

    /** 更新文章 */
    @PutMapping("/{id}")
    public Result<ArticleSummaryVO> update(@PathVariable Long id,
                                           @Valid @RequestBody ArticleSaveDTO dto) {
        return Result.success(articleService.update(id, dto));
    }

    /** 删除文章（逻辑删除） */
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        articleService.delete(id);
        return Result.success();
    }
}
