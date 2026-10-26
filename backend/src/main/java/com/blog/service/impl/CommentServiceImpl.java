package com.blog.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.blog.common.BusinessException;
import com.blog.common.PageResult;
import com.blog.common.ResultCode;
import com.blog.dto.CommentCreateDTO;
import com.blog.entity.Article;
import com.blog.entity.Comment;
import com.blog.entity.User;
import com.blog.mapper.ArticleMapper;
import com.blog.mapper.CommentMapper;
import com.blog.mapper.UserMapper;
import com.blog.security.LoginUser;
import com.blog.security.SecurityUtils;
import com.blog.service.CommentService;
import com.blog.vo.CommentAdminVO;
import com.blog.vo.CommentVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 评论服务实现：两级评论、审核状态、点赞/取消点赞（Redis Set 去重）。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CommentServiceImpl implements CommentService {

    private static final String COMMENT_LIKE_KEY_PREFIX = "comment:like:";

    private final CommentMapper commentMapper;
    private final ArticleMapper articleMapper;
    private final UserMapper userMapper;
    private final StringRedisTemplate stringRedisTemplate;

    @Override
    public List<CommentVO> listByArticle(Long articleId) {
        List<CommentVO> all = commentMapper.selectApprovedByArticle(articleId);
        // 先收集一级评论（保持时间顺序），再把回复挂到父评论下
        Map<Long, CommentVO> roots = new LinkedHashMap<>();
        for (CommentVO vo : all) {
            vo.setReplies(new ArrayList<>());
            if (vo.getParentId() == null) {
                roots.put(vo.getId(), vo);
            }
        }
        for (CommentVO vo : all) {
            if (vo.getParentId() == null) {
                continue;
            }
            CommentVO parent = roots.get(vo.getParentId());
            if (parent != null) {
                parent.getReplies().add(vo);
            } else {
                // 父评论未通过审核时，把回复作为一级评论展示，避免内容丢失
                roots.putIfAbsent(vo.getId(), vo);
            }
        }
        markLiked(all);
        return new ArrayList<>(roots.values());
    }

    /** 给当前登录用户标记已点赞状态；未登录或 Redis 异常时保持 null/false */
    private void markLiked(List<CommentVO> comments) {
        LoginUser loginUser = SecurityUtils.getLoginUserOrNull();
        if (loginUser == null) {
            return;
        }
        String userId = String.valueOf(loginUser.getId());
        for (CommentVO vo : comments) {
            try {
                vo.setLiked(Boolean.TRUE.equals(
                        stringRedisTemplate.opsForSet().isMember(likeKey(vo.getId()), userId)));
            } catch (Exception e) {
                log.warn("读取评论点赞状态失败：{}", e.getMessage());
            }
        }
    }

    @Override
    @Transactional
    public CommentVO create(CommentCreateDTO dto) {
        Article article = articleMapper.selectById(dto.getArticleId());
        if (article == null || !Integer.valueOf(1).equals(article.getStatus())) {
            throw new BusinessException(ResultCode.NOT_FOUND, "文章不存在或未发布");
        }
        Long parentId = dto.getParentId();
        if (parentId != null) {
            Comment parent = commentMapper.selectById(parentId);
            if (parent == null || !dto.getArticleId().equals(parent.getArticleId())) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "父评论不存在");
            }
            // 只允许两级：若父级是回复，则挂到其父评论下
            if (parent.getParentId() != null) {
                parentId = parent.getParentId();
            }
        }
        LoginUser loginUser = SecurityUtils.getLoginUser();
        Comment comment = new Comment();
        comment.setArticleId(dto.getArticleId());
        comment.setUserId(loginUser.getId());
        comment.setParentId(parentId);
        comment.setContent(dto.getContent().trim());
        comment.setStatus(0);
        comment.setLikeCount(0);
        commentMapper.insert(comment);
        return toVO(comment, loginUser.getId());
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Comment comment = commentMapper.selectById(id);
        if (comment == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "评论不存在");
        }
        LoginUser loginUser = SecurityUtils.getLoginUser();
        if (!loginUser.isAdmin() && !loginUser.getId().equals(comment.getUserId())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "只能删除自己的评论");
        }
        deleteWithReplies(id);
    }

    @Override
    @Transactional
    public Map<String, Object> like(Long id) {
        Comment comment = requireApproved(id);
        Long userId = SecurityUtils.getUserId();
        // Redis Set 去重：同一用户对同一评论只计一次（add 返回本次实际加入的数量）
        Long added = stringRedisTemplate.opsForSet().add(likeKey(id), String.valueOf(userId));
        if (added != null && added > 0) {
            commentMapper.update(null, new LambdaUpdateWrapper<Comment>()
                    .eq(Comment::getId, id)
                    .setSql("like_count = like_count + 1"));
        }
        return likeState(comment, true);
    }

    @Override
    @Transactional
    public Map<String, Object> unlike(Long id) {
        Comment comment = requireApproved(id);
        Long userId = SecurityUtils.getUserId();
        Long removed = stringRedisTemplate.opsForSet().remove(likeKey(id), String.valueOf(userId));
        if (removed != null && removed > 0) {
            commentMapper.update(null, new LambdaUpdateWrapper<Comment>()
                    .eq(Comment::getId, id)
                    .setSql("like_count = GREATEST(like_count - 1, 0)"));
        }
        return likeState(comment, false);
    }

    private Comment requireApproved(Long id) {
        Comment comment = commentMapper.selectById(id);
        if (comment == null || !Integer.valueOf(1).equals(comment.getStatus())) {
            throw new BusinessException(ResultCode.NOT_FOUND, "评论不存在或未通过审核");
        }
        return comment;
    }

    /** 返回最新的点赞状态与点赞数 */
    private Map<String, Object> likeState(Comment comment, boolean liked) {
        Comment latest = commentMapper.selectById(comment.getId());
        int likeCount = latest == null || latest.getLikeCount() == null ? 0 : latest.getLikeCount();
        return Map.of("liked", liked, "likeCount", likeCount);
    }

    private String likeKey(Long commentId) {
        return COMMENT_LIKE_KEY_PREFIX + commentId;
    }

    @Override
    public PageResult<CommentAdminVO> adminPage(int pageNum, int pageSize, Integer status) {
        int current = Math.max(1, pageNum);
        int size = Math.min(Math.max(1, pageSize), 50);
        Page<CommentAdminVO> page = new Page<>(current, size);
        Page<CommentAdminVO> result = (Page<CommentAdminVO>) commentMapper.selectAdminPage(page, status);
        result.getRecords().forEach(vo -> vo.setReplies(new ArrayList<>()));
        return PageResult.of(result);
    }

    @Override
    @Transactional
    public void audit(Long id, Integer status) {
        Comment comment = commentMapper.selectById(id);
        if (comment == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "评论不存在");
        }
        Comment update = new Comment();
        update.setId(id);
        update.setStatus(status);
        commentMapper.updateById(update);
    }

    @Override
    @Transactional
    public void adminDelete(Long id) {
        Comment comment = commentMapper.selectById(id);
        if (comment == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "评论不存在");
        }
        deleteWithReplies(id);
    }

    /** 删除评论及其二级回复，并清理点赞缓存 */
    private void deleteWithReplies(Long id) {
        List<Comment> replies = commentMapper.selectList(
                new LambdaQueryWrapper<Comment>().eq(Comment::getParentId, id));
        commentMapper.delete(new LambdaQueryWrapper<Comment>().eq(Comment::getParentId, id));
        commentMapper.deleteById(id);
        clearLikeKeys(id, replies);
    }

    private void clearLikeKeys(Long id, List<Comment> replies) {
        try {
            stringRedisTemplate.delete(likeKey(id));
            for (Comment reply : replies) {
                stringRedisTemplate.delete(likeKey(reply.getId()));
            }
        } catch (Exception e) {
            log.warn("清理评论点赞缓存失败：{}", e.getMessage());
        }
    }

    private CommentVO toVO(Comment comment, Long userId) {
        CommentVO vo = new CommentVO();
        vo.setId(comment.getId());
        vo.setArticleId(comment.getArticleId());
        vo.setUserId(comment.getUserId());
        vo.setParentId(comment.getParentId());
        vo.setContent(comment.getContent());
        vo.setLikeCount(comment.getLikeCount());
        vo.setLiked(Boolean.FALSE);
        vo.setCreateTime(comment.getCreateTime());
        vo.setReplies(new ArrayList<>());
        User user = userMapper.selectById(userId);
        if (user != null) {
            vo.setNickname(user.getNickname() == null ? user.getUsername() : user.getNickname());
            vo.setAvatar(user.getAvatar());
        }
        return vo;
    }
}
