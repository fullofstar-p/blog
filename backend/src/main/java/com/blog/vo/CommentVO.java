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
    private String content;
    private Integer likeCount;

    /** 当前登录用户是否已点赞；未登录时为 null */
    private Boolean liked;

    private LocalDateTime createTime;
    private List<CommentVO> replies;
}
