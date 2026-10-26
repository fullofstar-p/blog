package com.blog.common;

import com.baomidou.mybatisplus.core.metadata.IPage;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * 统一分页返回体：{ records, total, pageNum, pageSize }。
 *
 * @param <T> 记录类型
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class PageResult<T> {

    private List<T> records;
    private long total;
    private long pageNum;
    private long pageSize;

    /**
     * 由 MyBatis-Plus 分页对象转换。
     */
    public static <T> PageResult<T> of(IPage<T> page) {
        return new PageResult<>(page.getRecords(), page.getTotal(), page.getCurrent(), page.getSize());
    }

    /**
     * 由普通列表 + 统计信息转换（用于联表查询后再次加工的场景）。
     */
    public static <T> PageResult<T> of(List<T> records, long total, long pageNum, long pageSize) {
        return new PageResult<>(records, total, pageNum, pageSize);
    }
}
