package com.blog.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.blog.common.BusinessException;
import com.blog.common.PageResult;
import com.blog.common.ResultCode;
import com.blog.constant.PageConstants;
import com.blog.constant.SecurityConstants;
import com.blog.constant.UserConstants;
import com.blog.dto.ChangePasswordDTO;
import com.blog.dto.UpdateProfileDTO;
import com.blog.entity.User;
import com.blog.mapper.UserMapper;
import com.blog.security.LoginUser;
import com.blog.security.SecurityUtils;
import com.blog.service.UserService;
import com.blog.vo.UserVO;
import lombok.RequiredArgsConstructor;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Objects;

/**
 * 用户服务实现。
 */
@Service
@RequiredArgsConstructor
public class UserServiceImpl implements UserService {

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    @Override
    public UserVO getCurrentUser() {
        return toVO(getLoginUserEntity());
    }

    @Override
    @Transactional
    public UserVO updateProfile(UpdateProfileDTO dto) {
        User user = getLoginUserEntity();
        if (dto.getNickname() != null) {
            user.setNickname(dto.getNickname().trim());
        }
        if (dto.getEmail() != null) {
            user.setEmail(dto.getEmail().trim());
        }
        if (dto.getAvatar() != null) {
            user.setAvatar(dto.getAvatar().trim());
        }
        userMapper.updateById(user);
        return toVO(userMapper.selectById(user.getId()));
    }

    @Override
    @Transactional
    public void changePassword(ChangePasswordDTO dto) {
        User user = getLoginUserEntity();
        if (!passwordEncoder.matches(dto.getOldPassword(), user.getPassword())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "原密码错误");
        }
        if (passwordEncoder.matches(dto.getNewPassword(), user.getPassword())) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "新密码不能与原密码相同");
        }
        User update = new User();
        update.setId(user.getId());
        update.setPassword(passwordEncoder.encode(dto.getNewPassword()));
        userMapper.updateById(update);
    }

    @Override
    public PageResult<UserVO> adminPage(int pageNum, int pageSize, String keyword, String role, Integer status) {
        int current = Math.max(PageConstants.MIN_PAGE_NUM, pageNum);
        int size = Math.min(Math.max(PageConstants.MIN_PAGE_SIZE, pageSize), PageConstants.MAX_PAGE_SIZE);
        LambdaQueryWrapper<User> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(keyword)) {
            String kw = keyword.trim();
            wrapper.and(w -> w.like(User::getUsername, kw)
                    .or().like(User::getNickname, kw)
                    .or().like(User::getEmail, kw));
        }
        if (StringUtils.hasText(role)) {
            wrapper.eq(User::getRole, role.trim().toUpperCase());
        }
        if (status != null) {
            wrapper.eq(User::getStatus, status);
        }
        wrapper.orderByDesc(User::getCreateTime);
        Page<User> page = userMapper.selectPage(new Page<>(current, size), wrapper);
        List<UserVO> records = page.getRecords().stream().map(this::toVO).toList();
        return PageResult.of(records, page.getTotal(), page.getCurrent(), page.getSize());
    }

    @Override
    @Transactional
    public void updateStatus(Long id, Integer status) {
        User target = userMapper.selectById(id);
        if (target == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "用户不存在");
        }
        LoginUser loginUser = SecurityUtils.getLoginUser();
        if (loginUser.getId().equals(id) && Objects.equals(status, UserConstants.STATUS_DISABLED)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "不能禁用当前登录账号");
        }
        User update = new User();
        update.setId(id);
        update.setStatus(status);
        userMapper.updateById(update);
    }

    @Override
    @Transactional
    public void updateRole(Long id, String role) {
        User target = userMapper.selectById(id);
        if (target == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "用户不存在");
        }
        LoginUser loginUser = SecurityUtils.getLoginUser();
        if (loginUser.getId().equals(id) && SecurityConstants.ROLE_USER.equalsIgnoreCase(role)) {
            throw new BusinessException(ResultCode.BAD_REQUEST, "不能修改当前登录账号的角色");
        }
        User update = new User();
        update.setId(id);
        update.setRole(role.trim().toUpperCase());
        userMapper.updateById(update);
    }

    private User getLoginUserEntity() {
        Long userId = SecurityUtils.getUserId();
        User user = userMapper.selectById(userId);
        if (user == null) {
            throw new BusinessException(ResultCode.NOT_FOUND, "用户不存在");
        }
        return user;
    }

    private UserVO toVO(User user) {
        UserVO vo = new UserVO();
        vo.setId(user.getId());
        vo.setUsername(user.getUsername());
        vo.setNickname(user.getNickname());
        vo.setAvatar(user.getAvatar());
        vo.setEmail(user.getEmail());
        vo.setRole(user.getRole());
        vo.setStatus(user.getStatus());
        vo.setCreateTime(user.getCreateTime());
        return vo;
    }
}
