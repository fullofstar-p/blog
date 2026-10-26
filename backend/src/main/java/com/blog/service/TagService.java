package com.blog.service;

import com.blog.dto.TagSaveDTO;
import com.blog.vo.TagVO;

import java.util.List;

/**
 * 标签服务。
 */
public interface TagService {

    /** 标签列表（含已发布文章数） */
    List<TagVO> list();

    /** 新增标签 */
    TagVO create(TagSaveDTO dto);

    /** 更新标签 */
    TagVO update(Long id, TagSaveDTO dto);

    /** 删除标签（同时清理文章关联） */
    void delete(Long id);
}
