package com.blog.service;

import com.blog.common.PageResult;
import com.blog.dto.ChangePasswordDTO;
import com.blog.dto.UpdateProfileDTO;
import com.blog.vo.UserVO;

/**
 * 用户服务（含管理端用户管理）。
 */
public interface UserService {

    /** 当前登录用户信息 */
    UserVO getCurrentUser();

    /** 修改个人资料 */
    UserVO updateProfile(UpdateProfileDTO dto);

    /** 修改密码 */
    void changePassword(ChangePasswordDTO dto);

    /** 管理端用户分页 */
    PageResult<UserVO> adminPage(int pageNum, int pageSize, String keyword, String role, Integer status);

    /** 管理端启用/禁用用户 */
    void updateStatus(Long id, Integer status);

    /** 管理端修改用户角色 */
    void updateRole(Long id, String role);
}
