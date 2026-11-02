package com.blog.init;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.blog.constant.SecurityConstants;
import com.blog.constant.UserConstants;
import com.blog.entity.User;
import com.blog.mapper.UserMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * 数据初始化：首次启动且不存在 ADMIN 账号时，创建初始管理员。
 * 用户名/密码来自环境变量 ADMIN_USERNAME / ADMIN_PASSWORD（默认 admin / admin123456）。
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private static final String DEFAULT_ADMIN_PASSWORD = "admin123456";

    private final UserMapper userMapper;
    private final PasswordEncoder passwordEncoder;

    @Value("${admin.username:admin}")
    private String adminUsername;

    @Value("${admin.password:admin123456}")
    private String adminPassword;

    @Override
    public void run(ApplicationArguments args) {
        Long adminCount = userMapper.selectCount(
                new LambdaQueryWrapper<User>().eq(User::getRole, SecurityConstants.ROLE_ADMIN));
        if (adminCount != null && adminCount > 0) {
            log.info("已存在 ADMIN 账号，跳过初始管理员创建");
            return;
        }
        User admin = new User();
        admin.setUsername(adminUsername);
        admin.setPassword(passwordEncoder.encode(adminPassword));
        admin.setNickname("管理员");
        admin.setRole(SecurityConstants.ROLE_ADMIN);
        admin.setStatus(UserConstants.STATUS_ENABLED);
        userMapper.insert(admin);
        log.info("已创建初始管理员账号：{}", adminUsername);
        if (DEFAULT_ADMIN_PASSWORD.equals(adminPassword)) {
            log.warn("初始管理员仍在使用默认密码，生产环境请通过 ADMIN_PASSWORD 环境变量修改");
        }
    }
}
