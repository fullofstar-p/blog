package com.blog.vo;

import lombok.Data;

import java.util.List;

/**
 * 归档视图对象：年份 + 每月文章数。
 */
@Data
public class ArchiveVO {

    private Integer year;

    private List<MonthCount> months;

    /**
     * 某年某月的文章数。
     */
    @Data
    public static class MonthCount {

        private Integer month;

        private Long count;
    }
}
