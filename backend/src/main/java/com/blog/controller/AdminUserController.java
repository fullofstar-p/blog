package com.blog.controller;

import com.blog.common.PageResult;
import com.blog.common.Result;
import com.blog.constant.SecurityConstants;
import com.blog.dto.UserRoleDTO;
import com.blog.dto.UserStatusDTO;
import com.blog.service.UserService;
import com.blog.vo.UserVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * 管理端用户接口：/api/admin/users（仅 ADMIN）。
 */
@RestController
@RequestMapping("/api/admin/users")
@PreAuthorize(SecurityConstants.HAS_ROLE_ADMIN)
@RequiredArgsConstructor
public class AdminUserController {

    private final UserService userService;

    @GetMapping
    public Result<PageResult<UserVO>> list(
            @RequestParam(defaultValue = "1") int pageNum,
            @RequestParam(defaultValue = "10") int pageSize,
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) Integer status) {
        return Result.success(userService.adminPage(pageNum, pageSize, keyword, role, status));
    }

    @PutMapping("/{id}/status")
    public Result<Void> updateStatus(@PathVariable Long id,
                                     @Valid @RequestBody UserStatusDTO dto) {
        userService.updateStatus(id, dto.getStatus());
        return Result.success();
    }

    @PutMapping("/{id}/role")
    public Result<Void> updateRole(@PathVariable Long id,
                                   @Valid @RequestBody UserRoleDTO dto) {
        userService.updateRole(id, dto.getRole());
        return Result.success();
    }
}
