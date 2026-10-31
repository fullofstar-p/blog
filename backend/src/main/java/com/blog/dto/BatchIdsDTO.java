package com.blog.dto;

import com.blog.constant.PageConstants;

import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

/**
 * 批量操作文章请求。
 */
@Data
public class BatchIdsDTO {

    @NotEmpty(message = "请选择文章")
    @Size(max = PageConstants.BATCH_MAX_SIZE, message = "单次最多操作 100 篇文章")
    private List<Long> ids;
}
