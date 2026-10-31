package com.blog.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.conditions.update.LambdaUpdateWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.blog.common.BusinessException;
import com.blog.common.NotificationType;
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
import com.blog.service.NotificationService;
import com.blog.vo.CommentAdminVO;
import com.blog.vo.CommentVO;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * 评论服务实现：
 * - 楼中楼：parent_id 指向直接父评论，root_id 指向楼层根，depth 0..4（最多 5 层）；
 * - 只能回复已通过审核的评论；删除父评论递归删除整棵子树；
 * - 审核状态变化时发送站内通知，通知失败不影响审核事务。
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CommentServiceImpl implements CommentService {

    private static final String COMMENT_LIKE_KEY_PREFIX = "comment:like:";
    /** 最大嵌套层级：0 为一级，4 为第五层 */
    private static final int MAX_DEPTH = 4;

    private final CommentMapper commentMapper;
    private final ArticleMapper articleMapper;
    private final UserMapper userMapper;
    private final NotificationService notificationService;
    private final StringRedisTemplate stringRedisTemplate;

    @Override
    public List<CommentVO> listByArticle(Long articleId) {
        List<CommentVO> all = commentMapper.selectApprovedByArticle(articleId);
        Map<Long, CommentVO> byId = new LinkedHashMap<>();
        for (CommentVO vo : all) {
            vo.setReplies(new ArrayList<>());
            byId.put(vo.getId(), vo);
        }
        List<CommentVO> roots = new ArrayList<>();
        for (CommentVO vo : all) {
            if (vo.getParentId() == null) {
                roots.add(vo);
                continue;
            }
            CommentVO parent = byId.get(vo.getParentId());
            if (parent != null) {
                parent.getReplies().add(vo);
            } else {
                // 父评论未通过审核时把回复作为一级展示，避免内容丢失
                roots.add(vo);
            }
        }
        markLiked(all);
        return roots;
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
        Comment parent = null;
        if (dto.getParentId() != null) {
            parent = commentMapper.selectById(dto.getParentId());
            if (parent == null || !dto.getArticleId().equals(parent.getArticleId())) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "父评论不存在");
            }
            if (!Integer.valueOf(1).equals(parent.getStatus())) {
                throw new BusinessException(ResultCode.BAD_REQUEST, "只能回复已通过的评论");
            }
        }
        int depth = parent == null ? 0 : (parent.getDepth() == null ? 0 : parent.getDepth()) + 1;
        if (depth > MAX_DEPTH) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "回复层级过深");
        }

        LoginUser loginUser = SecurityUtils.getLoginUser();
        Comment comment = new Comment();
        comment.setArticleId(dto.getArticleId());
        comment.setUserId(loginUser.getId());
        comment.setParentId(parent == null ? null : parent.getId());
        comment.setRootId(parent == null ? null
                : (parent.getRootId() == null ? parent.getId() : parent.getRootId()));
        comment.setReplyToUserId(parent == null ? null : parent.getUserId());
        comment.setDepth(depth);
        comment.setContent(dto.getContent().trim());
        comment.setStatus(0);
        comment.setLikeCount(0);
        commentMapper.insert(comment);

        // 根评论插入后回填 root_id = 自身 id
        if (parent == null) {
            comment.setRootId(comment.getId());
            commentMapper.update(null, new LambdaUpdateWrapper<Comment>()
                    .eq(Comment::getId, comment.getId())
                    .set(Comment::getRootId, comment.getId()));
        }

        CommentVO vo = toVO(comment, loginUser.getId());
        if (parent != null) {
            vo.setReplyToNickname(nicknameOf(parent.getUserId()));
        }
        return vo;
    }

    @Override
    @Transactional
    public void delete(Long id) {
        Comment comment = requireComment(id);
        LoginUser loginUser = SecurityUtils.getLoginUser();
        if (!loginUser.isAdmin() && !loginUser.getId().equals(comment.getUserId())) {
            throw new BusinessException(ResultCode.FORBIDDEN, "只能删除自己的评论");
        }
        deleteSubtree(id);
    }

    @Override
    @Transactional
    public Map<String, Object> like(Long id) {
        Comment comment = requireApproved(id);
        Long userId = SecurityUtils.getUserId();
        // Redis Set 去重：同一用户对同一评论只计一次
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
        if (status == null || (status != 1 && status != 2)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "审核状态不合法");
        }
        Comment comment = requireComment(id);
        boolean changed = !Objects.equals(comment.getStatus(), status);
        if (changed) {
            commentMapper.update(null, new LambdaUpdateWrapper<Comment>()
                    .eq(Comment::getId, id)
                    .set(Comment::getStatus, status));
        }
        if (!changed) {
            return;
        }
        // 通知失败不能影响审核事务：每个通知单独 try/catch 记 warn
        if (Integer.valueOf(1).equals(status)) {
            safeNotify(() -> notifyApproved(comment), comment, "通过");
        }
        safeNotify(() -> notifyAuditResult(comment, status), comment, "审核结果");
    }

    @Override
    @Transactional
    public void adminDelete(Long id) {
        requireComment(id);
        deleteSubtree(id);
    }

    /** 审核通过：根评论通知文章作者；回复通知直接父评论作者（父作者即文章作者时只发 REPLY） */
    private void notifyApproved(Comment comment) {
        Article article = articleMapper.selectById(comment.getArticleId());
        Long senderId = comment.getUserId();
        String senderName = nicknameOf(senderId);
        String excerpt = excerpt(comment.getContent());
        String articleTitle = article == null || article.getTitle() == null ? "" : article.getTitle();

        if (comment.getParentId() == null) {
            if (article == null || article.getAuthorId() == null
                    || article.getAuthorId().equals(senderId)) {
                return;
            }
            notificationService.send(article.getAuthorId(), NotificationType.COMMENT,
                    "收到新评论",
                    senderName + " 评论了你的文章《" + articleTitle + "》：" + excerpt,
                    comment.getArticleId(), comment.getId(), senderId);
            return;
        }
        Comment parent = commentMapper.selectById(comment.getParentId());
        if (parent == null || parent.getUserId() == null || parent.getUserId().equals(senderId)) {
            return;
        }
        notificationService.send(parent.getUserId(), NotificationType.REPLY,
                "有人回复了你",
                senderName + " 回复了你的评论：" + excerpt,
                comment.getArticleId(), comment.getId(), senderId);
    }

    /** 审核结果通知评论作者；管理员审核自己的评论时跳过 */
    private void notifyAuditResult(Comment comment, Integer status) {
        LoginUser operator = SecurityUtils.getLoginUserOrNull();
        Long operatorId = operator == null ? null : operator.getId();
        if (operatorId != null && operatorId.equals(comment.getUserId())) {
            return;
        }
        Article article = articleMapper.selectById(comment.getArticleId());
        String articleTitle = article == null || article.getTitle() == null ? "" : article.getTitle();
        boolean approved = Integer.valueOf(1).equals(status);
        String title = approved ? "评论已通过审核" : "评论未通过审核";
        String content = "你在《" + articleTitle + "》下的评论"
                + (approved ? "已通过审核：" : "未通过审核：") + excerpt(comment.getContent());
        notificationService.send(comment.getUserId(), NotificationType.COMMENT_AUDIT,
                title, content, comment.getArticleId(), comment.getId(), operatorId);
    }

    /** 通知异常只记日志，不向外抛 */
    private void safeNotify(Runnable action, Comment comment, String scene) {
        try {
            action.run();
        } catch (Exception e) {
            log.warn("评论{}通知发送失败，commentId={}：{}", scene, comment.getId(), e.getMessage());
        }
    }

    private Comment requireComment(Long id) {
        Comment comment = commentMapper.selectById(id);
        if (comment == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "评论不存在");
        }
        return comment;
    }

    private Comment requireApproved(Long id) {
        Comment comment = commentMapper.selectById(id);
        if (comment == null || !Integer.valueOf(1).equals(comment.getStatus())) {
            throw new BusinessException(ResultCode.NOT_FOUND, "评论不存在或未通过审核");
        }
        return comment;
    }

    /** 收集整棵子树（含自身）的评论 ID，最多下探 MAX_DEPTH 层 */
    private List<Long> collectSubtree(Long rootId) {
        List<Long> ids = new ArrayList<>();
        ids.add(rootId);
        List<Long> frontier = new ArrayList<>();
        frontier.add(rootId);
        for (int level = 0; level <= MAX_DEPTH && !frontier.isEmpty(); level++) {
            List<Comment> children = commentMapper.selectList(new LambdaQueryWrapper<Comment>()
                    .select(Comment::getId)
                    .in(Comment::getParentId, frontier));
            if (children.isEmpty()) {
                break;
            }
            frontier = children.stream().map(Comment::getId).collect(Collectors.toList());
            ids.addAll(frontier);
        }
        return ids;
    }

    /** 删除整棵子树并清理点赞缓存 */
    private void deleteSubtree(Long id) {
        List<Long> ids = collectSubtree(id);
        commentMapper.delete(new LambdaQueryWrapper<Comment>().in(Comment::getId, ids));
        clearLikeKeys(ids);
    }

    private void clearLikeKeys(List<Long> ids) {
        try {
            List<String> keys = ids.stream().map(this::likeKey).collect(Collectors.toList());
            if (!keys.isEmpty()) {
                stringRedisTemplate.delete(keys);
            }
        } catch (Exception e) {
            log.warn("清理评论点赞缓存失败：{}", e.getMessage());
        }
    }

    private String likeKey(Long commentId) {
        return COMMENT_LIKE_KEY_PREFIX + commentId;
    }

    /** 返回最新的点赞状态与点赞数 */
    private Map<String, Object> likeState(Comment comment, boolean liked) {
        Comment latest = commentMapper.selectById(comment.getId());
        int likeCount = latest == null || latest.getLikeCount() == null ? 0 : latest.getLikeCount();
        return Map.of("liked", liked, "likeCount", likeCount);
    }

    private String nicknameOf(Long userId) {
        if (userId == null) {
            return "用户";
        }
        User user = userMapper.selectById(userId);
        if (user == null) {
            return "用户";
        }
        return StringUtils.hasText(user.getNickname()) ? user.getNickname() : user.getUsername();
    }

    private String excerpt(String content) {
        if (!StringUtils.hasText(content)) {
            return "";
        }
        String text = content.replaceAll("\\s+", " ").trim();
        return text.length() <= 60 ? text : text.substring(0, 60) + "…";
    }

    private CommentVO toVO(Comment comment, Long userId) {
        CommentVO vo = new CommentVO();
        vo.setId(comment.getId());
        vo.setArticleId(comment.getArticleId());
        vo.setUserId(comment.getUserId());
        vo.setParentId(comment.getParentId());
        vo.setRootId(comment.getRootId());
        vo.setReplyToUserId(comment.getReplyToUserId());
        vo.setDepth(comment.getDepth());
        vo.setContent(comment.getContent());
        vo.setLikeCount(comment.getLikeCount());
        vo.setLiked(Boolean.FALSE);
        vo.setCreateTime(comment.getCreateTime());
        vo.setReplies(new ArrayList<>());
        User user = userMapper.selectById(userId);
        if (user != null) {
            vo.setNickname(StringUtils.hasText(user.getNickname()) ? user.getNickname() : user.getUsername());
            vo.setAvatar(user.getAvatar());
        }
        return vo;
    }
}
