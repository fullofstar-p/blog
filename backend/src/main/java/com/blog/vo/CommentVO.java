package com.blog.vo;

import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * 前台评论视图对象（两级树：一级评论 + replies）。
 */
@Data
public class CommentVO {

    private Long id;
    private Long articleId;
    private Long userId;
    private String nickname;
    private String avatar;
    private Long parentId;

    /** 楼中楼根评论 ID */
    private Long rootId;

    /** 被回复的用户 ID */
    private Long replyToUserId;

    /** 被回复用户的昵称 */
    private String replyToNickname;

    /** 嵌套层级：0 为一级，最多 4 */
    private Integer depth;

    private String content;
    private Integer likeCount;

    /** 当前登录用户是否已点赞；未登录时为 null */
    private Boolean liked;

    private LocalDateTime createTime;
    private List<CommentVO> replies;
}
