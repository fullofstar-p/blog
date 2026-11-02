package com.blog.controller;

import com.blog.common.Result;
import com.blog.constant.SecurityConstants;
import com.blog.service.StatsService;
import com.blog.vo.DashboardVO;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理端内容看板接口：/api/admin/stats（仅 ADMIN）。
 */
@RestController
@RequestMapping("/api/admin/stats")
@PreAuthorize(SecurityConstants.HAS_ROLE_ADMIN)
@RequiredArgsConstructor
public class AdminStatsController {

    private final StatsService statsService;

    @GetMapping("/dashboard")
    public Result<DashboardVO> dashboard(@RequestParam(defaultValue = "30") int days) {
        return Result.success(statsService.dashboard(days));
    }
}
