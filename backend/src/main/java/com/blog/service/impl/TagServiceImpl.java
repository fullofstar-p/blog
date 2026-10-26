package com.blog.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.blog.common.BusinessException;
import com.blog.common.ResultCode;
import com.blog.dto.TagSaveDTO;
import com.blog.entity.ArticleTag;
import com.blog.entity.Tag;
import com.blog.mapper.ArticleTagMapper;
import com.blog.mapper.TagMapper;
import com.blog.service.TagService;
import com.blog.vo.TagVO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * 标签服务实现。
 */
@Service
@RequiredArgsConstructor
public class TagServiceImpl implements TagService {

    private final TagMapper tagMapper;
    private final ArticleTagMapper articleTagMapper;

    @Override
    public List<TagVO> list() {
        return tagMapper.selectWithCount();
    }

    @Override
    @Transactional
    public TagVO create(TagSaveDTO dto) {
        checkNameUnique(dto.getName(), null);
        Tag tag = new Tag();
        tag.setName(dto.getName().trim());
        tagMapper.insert(tag);
        return toVO(tag, 0);
    }

    @Override
    @Transactional
    public TagVO update(Long id, TagSaveDTO dto) {
        Tag tag = tagMapper.selectById(id);
        if (tag == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "标签不存在");
        }
        checkNameUnique(dto.getName(), id);
        tag.setName(dto.getName().trim());
        tagMapper.updateById(tag);
        return toVO(tag, countArticles(id));
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Tag tag = tagMapper.selectById(id);
        if (tag == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "标签不存在");
        }
        // 先清理文章-标签关联，再删除标签
        articleTagMapper.delete(new LambdaQueryWrapper<ArticleTag>().eq(ArticleTag::getTagId, id));
        tagMapper.deleteById(id);
    }

    private void checkNameUnique(String name, Long excludeId) {
        LambdaQueryWrapper<Tag> wrapper = new LambdaQueryWrapper<Tag>().eq(Tag::getName, name.trim());
        if (excludeId != null) {
            wrapper.ne(Tag::getId, excludeId);
        }
        if (tagMapper.selectCount(wrapper) > 0) {
            throw new BusinessException(ResultCode.CONFLICT, "标签名已存在");
        }
    }

    private int countArticles(Long tagId) {
        Long count = articleTagMapper.selectCount(
                new LambdaQueryWrapper<ArticleTag>().eq(ArticleTag::getTagId, tagId));
        return count == null ? 0 : count.intValue();
    }

    private TagVO toVO(Tag tag, int articleCount) {
        TagVO vo = new TagVO();
        vo.setId(tag.getId());
        vo.setName(tag.getName());
        vo.setArticleCount(articleCount);
        return vo;
    }
}
