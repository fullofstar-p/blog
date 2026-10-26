package com.blog.controller;

import com.blog.common.Result;
import com.blog.dto.ChangePasswordDTO;
import com.blog.dto.UpdateProfileDTO;
import com.blog.service.UserService;
import com.blog.vo.UserVO;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 当前用户接口：/api/users/me。
 */
@RestController
@RequestMapping("/api/users")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;

    @GetMapping("/me")
    public Result<UserVO> me() {
        return Result.success(userService.getCurrentUser());
    }

    @PutMapping("/me")
    public Result<UserVO> updateProfile(@Valid @RequestBody UpdateProfileDTO dto) {
        return Result.success(userService.updateProfile(dto));
    }

    @PutMapping("/me/password")
    public Result<Void> changePassword(@Valid @RequestBody ChangePasswordDTO dto) {
        userService.changePassword(dto);
        return Result.success();
    }
}
