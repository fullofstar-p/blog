package com.blog.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.blog.entity.Comment;
import com.blog.vo.CommentAdminVO;
import com.blog.vo.CommentVO;
import org.apache.ibatis.annotations.Param;

import java.util.List;

/**
 * 评论 Mapper：联表查询在 resources/mapper/CommentMapper.xml 中实现。
 */
public interface CommentMapper extends BaseMapper<Comment> {

    /**
     * 某篇文章下所有已通过的评论（不含树结构）。
     */
    List<CommentVO> selectApprovedByArticle(@Param("articleId") Long articleId);

    /**
     * 后台评论分页（可按审核状态过滤）。
     */
    IPage<CommentAdminVO> selectAdminPage(IPage<CommentAdminVO> page, @Param("status") Integer status);
}
