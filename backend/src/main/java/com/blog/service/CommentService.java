package com.blog.service;

import com.blog.common.PageResult;
import com.blog.dto.CommentCreateDTO;
import com.blog.vo.CommentAdminVO;
import com.blog.vo.CommentVO;

import java.util.List;
import java.util.Map;

/**
 * 评论服务（两级评论、审核、点赞）。
 */
public interface CommentService {

    /** 某篇文章下已通过的评论树 */
    List<CommentVO> listByArticle(Long articleId);

    /** 发表评论（待审核） */
    CommentVO create(CommentCreateDTO dto);

    /** 删除评论（本人或 ADMIN） */
    void delete(Long id);

    /** 点赞（同一用户重复点赞不重复计数），返回 { liked, likeCount } */
    Map<String, Object> like(Long id);

    /** 取消点赞（未点过赞时幂等），返回 { liked, likeCount } */
    Map<String, Object> unlike(Long id);

    /** 管理端评论分页 */
    PageResult<CommentAdminVO> adminPage(int pageNum, int pageSize, Integer status);

    /** 管理端审核（1 通过 / 2 拒绝） */
    void audit(Long id, Integer status);

    /** 管理端删除评论 */
    void adminDelete(Long id);
}
