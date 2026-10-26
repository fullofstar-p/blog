package com.blog.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.blog.entity.FileObject;
import org.apache.ibatis.annotations.Mapper;

/**
 * 文件对象审计 Mapper。
 */
@Mapper
public interface FileObjectMapper extends BaseMapper<FileObject> {
}
