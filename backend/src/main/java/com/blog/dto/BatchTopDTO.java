package com.blog.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * 批量置顶 / 取消置顶请求。
 */
@Data
public class BatchTopDTO {

    @NotEmpty(message = "请选择文章")
    @Size(max = 100, message = "单次最多操作 100 篇文章")
    private List<Long> ids;

    @NotNull(message = "置顶状态不能为空")
    @Min(value = 0, message = "置顶标记不合法")
    @Max(value = 1, message = "置顶标记不合法")
    private Integer isTop;
}
