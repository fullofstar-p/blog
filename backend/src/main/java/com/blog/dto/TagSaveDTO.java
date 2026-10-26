package com.blog.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

/**
 * 标签新增/更新请求参数。
 */
@Data
public class TagSaveDTO {

    @NotBlank(message = "标签名不能为空")
    @Size(max = 50, message = "标签名不能超过 50 个字符")
    private String name;
}
