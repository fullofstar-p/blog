package com.blog.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.blog.entity.User;
import org.apache.ibatis.annotations.Mapper;

/**
 * 用户 Mapper：基础 CRUD 使用 MyBatis-Plus。
 */
@Mapper
public interface UserMapper extends BaseMapper<User> {
}
