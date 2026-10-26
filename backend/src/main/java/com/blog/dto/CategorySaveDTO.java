package com.blog.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 分类新增/更新请求参数。
 */
@Data
public class CategorySaveDTO {

    @NotBlank(message = "分类名不能为空")
    @Size(max = 50, message = "分类名不能超过 50 个字符")
    private String name;

    /** 排序值，越小越靠前，默认 0 */
    private Integer sort;
}
