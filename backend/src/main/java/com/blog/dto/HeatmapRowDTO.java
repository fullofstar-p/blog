package com.blog.dto;

import lombok.Data;

/**
 * 发布热力图的按天聚合行。
 */
@Data
public class HeatmapRowDTO {

    /** yyyy-MM-dd */
    private String statDate;

    private Long count;
}
