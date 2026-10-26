package com.blog.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * 文章新增/更新请求参数。
 */
@Data
public class ArticleSaveDTO {

    @NotBlank(message = "标题不能为空")
    @Size(max = 200, message = "标题不能超过 200 个字符")
    private String title;

    @Size(max = 500, message = "摘要不能超过 500 个字符")
    private String summary;

    /** Markdown 正文：发布时必填，由 Service 兜底校验 */
    private String content;

    @Size(max = 500, message = "封面地址不能超过 500 个字符")
    private String cover;

    private Long categoryId;

    private List<Long> tagIds;

    /** 0 草稿 / 1 已发布，默认草稿 */
    @Min(value = 0, message = "文章状态不合法")
    @Max(value = 1, message = "文章状态不合法")
    private Integer status;

    /** 仅 ADMIN 可设置 */
    @Min(value = 0, message = "置顶标记不合法")
    @Max(value = 1, message = "置顶标记不合法")
    private Integer isTop;
}
