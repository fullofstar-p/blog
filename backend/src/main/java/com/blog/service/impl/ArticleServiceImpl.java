package com.blog.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.blog.common.BusinessException;
import com.blog.common.PageResult;
import com.blog.common.ResultCode;
import com.blog.dto.ArticleSaveDTO;
import com.blog.dto.ArchiveRowDTO;
import com.blog.entity.Article;
import com.blog.entity.ArticleTag;
import com.blog.entity.Category;
import com.blog.entity.Comment;
import com.blog.entity.Tag;
import com.blog.mapper.ArticleMapper;
import com.blog.mapper.ArticleTagMapper;
import com.blog.mapper.CategoryMapper;
import com.blog.mapper.CommentMapper;
import com.blog.mapper.TagMapper;
import com.blog.security.LoginUser;
import com.blog.security.SecurityUtils;
import com.blog.service.ArticleService;
import com.blog.service.ArticleTagAssembler;
import com.blog.vo.ArchiveVO;
import com.blog.vo.ArticleDetailVO;
import com.blog.vo.ArticleSummaryVO;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 文章服务实现：
 * - 列表/详情/搜索/归档走 ArticleMapper 的联表查询；
 * - 详情缓存 10 分钟，写操作时失效；
 * - 阅读量先写 Redis，由 ViewCountSyncTask 每 60 秒批量落库。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ArticleServiceImpl implements ArticleService {

    private static final String DETAIL_CACHE_PREFIX = "article:detail:";
    private static final Duration DETAIL_CACHE_TTL = Duration.ofMinutes(10);
    private static final String VIEW_COUNT_PREFIX = "article:views:";
    private static final String VIEW_PENDING_KEY = "article:views:pending";
    private static final int SUMMARY_MAX_LENGTH = 120;

    private final ArticleMapper articleMapper;
    private final ArticleTagMapper articleTagMapper;
    private final TagMapper tagMapper;
    private final CategoryMapper categoryMapper;
    private final CommentMapper commentMapper;
    private final ArticleTagAssembler articleTagAssembler;
    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;

    @Override
    public PageResult<ArticleSummaryVO> list(int pageNum, int pageSize, Long categoryId, Long tagId,
                                             String keyword, Integer year, Integer month, String sort) {
        int current = Math.max(1, pageNum);
        int size = Math.min(Math.max(1, pageSize), 50);
        String sortKey = "views".equalsIgnoreCase(sort) ? "views" : "time";
        String kw = trimToNull(keyword);
        long total = articleMapper.selectSummaryCount(kw, categoryId, tagId, null, 1, year, month);
        Page<ArticleSummaryVO> page = countSkippedPage(current, size, total);
        IPage<ArticleSummaryVO> result = articleMapper.selectSummaryPage(page, kw,
                categoryId, tagId, null, 1, year, month, sortKey, true);
        articleTagAssembler.fill(result.getRecords());
        return PageResult.of(result);
    }

    @Override
    public List<ArticleSummaryVO> top(int limit) {
        int limitValue = Math.min(Math.max(1, limit), 10);
        List<ArticleSummaryVO> list = articleMapper.selectTop(limitValue);
        articleTagAssembler.fill(list);
        return list;
    }

    @Override
    public ArticleDetailVO detail(Long id) {
        String cacheKey = DETAIL_CACHE_PREFIX + id;
        ArticleDetailVO detail = readDetailCache(cacheKey);
        boolean published;
        if (detail != null) {
            published = true;
        } else {
            detail = articleMapper.selectDetailById(id);
            if (detail == null) {
                throw new BusinessException(ResultCode.NOT_FOUND, "文章不存在");
            }
            published = Integer.valueOf(1).equals(detail.getStatus());
            // 草稿仅作者本人与 ADMIN 可见
            if (!published) {
                LoginUser loginUser = SecurityUtils.getLoginUserOrNull();
                boolean owner = loginUser != null && loginUser.getId().equals(detail.getAuthorId());
                boolean admin = loginUser != null && loginUser.isAdmin();
                if (!owner && !admin) {
                    throw new BusinessException(ResultCode.NOT_FOUND, "文章不存在");
                }
            }
            detail.setPrev(articleMapper.selectPrevArticle(id));
            detail.setNext(articleMapper.selectNextArticle(id));
            articleTagAssembler.fill(List.of(detail));
            if (published) {
                writeDetailCache(cacheKey, detail);
            }
        }
        // 阅读量：仅统计已发布文章，Redis 先自增。
        // 注意：详情缓存中的 viewCount 是写入缓存那一刻的快照，定时落库后 Redis 增量会归零，
        // 若直接用缓存里的旧值合并会导致阅读量回跳，因此这里始终以数据库当前值为基数。
        if (published) {
            Integer dbViewCount = articleMapper.selectViewCountById(id);
            String viewKey = VIEW_COUNT_PREFIX + id;
            Long delta = stringRedisTemplate.opsForValue().increment(viewKey);
            stringRedisTemplate.opsForSet().add(VIEW_PENDING_KEY, String.valueOf(id));
            int base = dbViewCount == null ? 0 : dbViewCount;
            detail.setViewCount(base + (delta == null ? 0 : delta.intValue()));
        }
        return detail;
    }

    @Override
    public List<ArchiveVO> archive() {
        List<ArchiveRowDTO> rows = articleMapper.selectArchive();
        Map<Integer, ArchiveVO> byYear = new LinkedHashMap<>();
        for (ArchiveRowDTO row : rows) {
            ArchiveVO yearVO = byYear.computeIfAbsent(row.getYear(), year -> {
                ArchiveVO vo = new ArchiveVO();
                vo.setYear(year);
                vo.setMonths(new ArrayList<>());
                return vo;
            });
            ArchiveVO.MonthCount monthCount = new ArchiveVO.MonthCount();
            monthCount.setMonth(row.getMonth());
            monthCount.setCount(row.getCount());
            yearVO.getMonths().add(monthCount);
        }
        return new ArrayList<>(byYear.values());
    }

    @Override
    public PageResult<ArticleSummaryVO> mine(int pageNum, int pageSize, Integer status) {
        Long userId = SecurityUtils.getUserId();
        int current = Math.max(1, pageNum);
        int size = Math.min(Math.max(1, pageSize), 50);
        long total = articleMapper.selectSummaryCount(null, null, null, userId, status, null, null);
        Page<ArticleSummaryVO> page = countSkippedPage(current, size, total);
        IPage<ArticleSummaryVO> result = articleMapper.selectSummaryPage(page, null, null, null,
                userId, status, null, null, "update", false);
        articleTagAssembler.fill(result.getRecords());
        return PageResult.of(result);
    }

    @Override
    @Transactional
    public ArticleSummaryVO create(ArticleSaveDTO dto) {
        LoginUser loginUser = SecurityUtils.getLoginUser();
        int status = dto.getStatus() == null ? 0 : dto.getStatus();
        checkContent(dto, status);
        checkCategory(dto.getCategoryId());

        Article article = new Article();
        article.setTitle(dto.getTitle().trim());
        article.setSummary(resolveSummary(dto));
        article.setContent(dto.getContent());
        article.setCover(trimToNull(dto.getCover()));
        article.setCategoryId(dto.getCategoryId());
        article.setAuthorId(loginUser.getId());
        article.setStatus(status);
        // isTop 仅 ADMIN 可设置，普通用户强制为 0
        article.setIsTop(loginUser.isAdmin() && Integer.valueOf(1).equals(dto.getIsTop()) ? 1 : 0);
        article.setViewCount(0);
        articleMapper.insert(article);
        saveTags(article.getId(), dto.getTagIds());
        return toSummary(articleMapper.selectSummaryById(article.getId()));
    }

    @Override
    @Transactional
    public ArticleSummaryVO update(Long id, ArticleSaveDTO dto) {
        LoginUser loginUser = SecurityUtils.getLoginUser();
        Article article = articleMapper.selectById(id);
        if (article == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "文章不存在");
        }
        if (!loginUser.isAdmin() && !loginUser.getId().equals(article.getAuthorId())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权修改该文章");
        }
        int status = dto.getStatus() == null ? article.getStatus() : dto.getStatus();
        checkContent(dto, status);
        checkCategory(dto.getCategoryId());

        article.setTitle(dto.getTitle().trim());
        article.setSummary(resolveSummary(dto));
        article.setContent(dto.getContent());
        article.setCover(trimToNull(dto.getCover()));
        if (dto.getCategoryId() != null) {
            article.setCategoryId(dto.getCategoryId());
        }
        article.setStatus(status);
        if (loginUser.isAdmin() && dto.getIsTop() != null) {
            article.setIsTop(dto.getIsTop());
        }
        articleMapper.updateById(article);
        saveTags(id, dto.getTagIds());
        evictDetailCache(id);
        return toSummary(articleMapper.selectSummaryById(id));
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Article article = articleMapper.selectById(id);
        if (article == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "文章不存在");
        }
        LoginUser loginUser = SecurityUtils.getLoginUser();
        if (!loginUser.isAdmin() && !loginUser.getId().equals(article.getAuthorId())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "无权删除该文章");
        }
        // 逻辑删除进回收站：保留 article_tag，恢复后标签仍在
        articleMapper.markDeleted(id);
        evictDetailCache(id);
    }

    @Override
    public PageResult<ArticleSummaryVO> adminPage(int pageNum, int pageSize, Integer status,
                                                  String keyword, Long categoryId) {
        int current = Math.max(1, pageNum);
        int size = Math.min(Math.max(1, pageSize), 50);
        String kw = trimToNull(keyword);
        long total = articleMapper.selectSummaryCount(kw, categoryId, null, null, status, null, null);
        Page<ArticleSummaryVO> page = countSkippedPage(current, size, total);
        IPage<ArticleSummaryVO> result = articleMapper.selectSummaryPage(page, kw,
                categoryId, null, null, status, null, null, "update", false);
        articleTagAssembler.fill(result.getRecords());
        return PageResult.of(result);
    }

    @Override
    @Transactional
    public void updateTop(Long id, Integer isTop) {
        Article article = articleMapper.selectById(id);
        if (article == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "文章不存在");
        }
        Article update = new Article();
        update.setId(id);
        update.setIsTop(isTop);
        articleMapper.updateById(update);
        evictDetailCache(id);
    }

    @Override
    @Transactional
    public void adminDelete(Long id) {
        Article article = articleMapper.selectById(id);
        if (article == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "文章不存在");
        }
        articleMapper.markDeleted(id);
        evictDetailCache(id);
    }

    @Override
    public PageResult<ArticleSummaryVO> recyclePage(int pageNum, int pageSize, String keyword) {
        int current = Math.max(1, pageNum);
        int size = Math.min(Math.max(1, pageSize), 50);
        String kw = trimToNull(keyword);
        long total = articleMapper.selectRecycleCount(kw);
        Page<ArticleSummaryVO> page = countSkippedPage(current, size, total);
        IPage<ArticleSummaryVO> result = articleMapper.selectRecyclePage(page, kw);
        articleTagAssembler.fill(result.getRecords());
        return PageResult.of(result);
    }

    @Override
    @Transactional
    public ArticleSummaryVO restore(Long id) {
        int updated = articleMapper.restore(id);
        if (updated == 0) {
            throw new BusinessException(ResultCode.NOT_FOUND, "文章不存在或未在回收站");
        }
        evictDetailCache(id);
        return toSummary(articleMapper.selectSummaryById(id));
    }

    @Override
    @Transactional
    public void purge(Long id) {
        int deleted = articleMapper.purge(id);
        if (deleted == 0) {
            throw new BusinessException(ResultCode.NOT_FOUND, "文章不存在或未在回收站");
        }
        articleTagMapper.delete(new LambdaQueryWrapper<ArticleTag>().eq(ArticleTag::getArticleId, id));
        commentMapper.delete(new LambdaQueryWrapper<Comment>().eq(Comment::getArticleId, id));
        evictDetailCache(id);
    }

    /** 发布状态下正文必填 */
    private void checkContent(ArticleSaveDTO dto, int status) {
        if (status == 1 && !StringUtils.hasText(dto.getContent())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "发布文章时正文不能为空");
        }
    }

    /** 分类存在性校验 */
    private void checkCategory(Long categoryId) {
        if (categoryId != null) {
            Category category = categoryMapper.selectById(categoryId);
            if (category == null) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "分类不存在");
            }
        }
    }

    /** 保存文章标签：先清空旧关联，再写入存在的标签 */
    private void saveTags(Long articleId, List<Long> tagIds) {
        articleTagMapper.delete(new LambdaQueryWrapper<ArticleTag>().eq(ArticleTag::getArticleId, articleId));
        if (tagIds == null || tagIds.isEmpty()) {
            return;
        }
        List<Long> distinctIds = tagIds.stream().filter(Objects::nonNull).distinct().toList();
        if (distinctIds.isEmpty()) {
            return;
        }
        Set<Long> validIds = tagMapper.selectBatchIds(distinctIds).stream()
                .map(Tag::getId).collect(Collectors.toSet());
        for (Long tagId : distinctIds) {
            if (!validIds.contains(tagId)) {
                continue;
            }
            ArticleTag articleTag = new ArticleTag();
            articleTag.setArticleId(articleId);
            articleTag.setTagId(tagId);
            articleTagMapper.insert(articleTag);
        }
    }

    /** 摘要为空时从正文前 120 字自动生成 */
    private String resolveSummary(ArticleSaveDTO dto) {
        if (StringUtils.hasText(dto.getSummary())) {
            return dto.getSummary().trim();
        }
        if (!StringUtils.hasText(dto.getContent())) {
            return null;
        }
        String plain = dto.getContent()
                .replaceAll("```[\\s\\S]*?```", " ")
                .replaceAll("!\\[[^\\]]*\\]\\([^)]*\\)", " ")
                .replaceAll("\\[([^\\]]*)\\]\\([^)]*\\)", "$1")
                .replaceAll("(?m)^#{1,6}\\s*", "")
                .replaceAll("[*_>`~#]", " ")
                .replaceAll("\\s+", " ")
                .trim();
        if (plain.isEmpty()) {
            return null;
        }
        return plain.length() <= SUMMARY_MAX_LENGTH ? plain : plain.substring(0, SUMMARY_MAX_LENGTH);
    }

    private ArticleSummaryVO toSummary(ArticleSummaryVO summary) {
        if (summary != null) {
            articleTagAssembler.fill(List.of(summary));
        }
        return summary;
    }

    /**
     * 构造「跳过插件自动 COUNT」的分页对象：total 由调用方显式统计。
     */
    private Page<ArticleSummaryVO> countSkippedPage(int current, int size, long total) {
        Page<ArticleSummaryVO> page = new Page<>(current, size);
        page.setSearchCount(false);
        page.setTotal(total);
        return page;
    }

    private ArticleDetailVO readDetailCache(String cacheKey) {
        try {
            String json = stringRedisTemplate.opsForValue().get(cacheKey);
            if (json == null) {
                return null;
            }
            return objectMapper.readValue(json, ArticleDetailVO.class);
        } catch (Exception e) {
            log.warn("读取文章详情缓存失败，将回源数据库：{}", e.getMessage());
            stringRedisTemplate.delete(cacheKey);
            return null;
        }
    }

    private void writeDetailCache(String cacheKey, ArticleDetailVO detail) {
        try {
            stringRedisTemplate.opsForValue().set(cacheKey, objectMapper.writeValueAsString(detail), DETAIL_CACHE_TTL);
        } catch (Exception e) {
            log.warn("写入文章详情缓存失败：{}", e.getMessage());
        }
    }

    private void evictDetailCache(Long id) {
        stringRedisTemplate.delete(DETAIL_CACHE_PREFIX + id);
    }

    private String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }
}
