package com.blog.service;

import com.blog.dto.ArticleTagRowDTO;
import com.blog.mapper.ArticleMapper;
import com.blog.vo.ArticleSummaryVO;
import com.blog.vo.TagVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

/**
 * 文章标签装配：按当前页文章 ID 批量查询标签，回填到 VO。
 *
 * <p>列表/搜索/详情都走这里，避免在 SQL 里用相关子查询逐行聚合标签：
 * 那种写法会让每次分页都随文章总量变慢，也会让分页 COUNT 退化成
 * 包裹整段复杂 SQL 的全量扫描。</p>
 */
@Component
@RequiredArgsConstructor
public class ArticleTagAssembler {

    private final ArticleMapper articleMapper;

    /**
     * 批量回填标签；无标签的文章设置为空列表，方便前端判空。
     */
    public void fill(List<? extends ArticleSummaryVO> records) {
        if (records == null || records.isEmpty()) {
            return;
        }
        List<Long> articleIds = records.stream()
                .map(ArticleSummaryVO::getId)
                .filter(Objects::nonNull)
                .distinct()
                .toList();
        Map<Long, List<TagVO>> tagsByArticle = new HashMap<>();
        if (!articleIds.isEmpty()) {
            for (ArticleTagRowDTO row : articleMapper.selectTagsByArticleIds(articleIds)) {
                TagVO tag = new TagVO();
                tag.setId(row.getTagId());
                tag.setName(row.getTagName());
                tag.setArticleCount(row.getArticleCount());
                tagsByArticle.computeIfAbsent(row.getArticleId(), key -> new ArrayList<>()).add(tag);
            }
        }
        for (ArticleSummaryVO vo : records) {
            List<TagVO> tags = tagsByArticle.get(vo.getId());
            vo.setTags(tags == null ? new ArrayList<>() : tags);
        }
    }
}
