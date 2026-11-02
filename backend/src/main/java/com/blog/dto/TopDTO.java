package com.blog.dto;

import com.blog.constant.ArticleConstants;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

/**
 * 管理端文章置顶参数：1 置顶 / 0 取消置顶。
 */
@Data
public class TopDTO {

    @NotNull(message = "置顶标记不能为空")
    @Min(value = ArticleConstants.NOT_TOP, message = "置顶标记不合法")
    @Max(value = ArticleConstants.TOP, message = "置顶标记不合法")
    private Integer isTop;
}
