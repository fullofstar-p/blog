package com.blog.dto;

import lombok.Data;

import java.time.LocalDate;

/**
 * 站点每日统计行（site_daily_stat）。
 */
@Data
public class DailyStatRowDTO {

    private LocalDate statDate;

    private Long pv;

    private Long uv;
}
