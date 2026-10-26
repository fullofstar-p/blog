package com.blog.dto;

import lombok.Data;

/**
 * 归档聚合查询的中间行（Mapper 内部使用，Service 组装为 ArchiveVO）。
 */
@Data
public class ArchiveRowDTO {

    private Integer year;

    private Integer month;

    private Long count;
}
