package com.blog.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.baomidou.mybatisplus.core.metadata.IPage;
import com.blog.entity.Notification;
import com.blog.vo.NotificationVO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

/**
 * 站内通知 Mapper：分页联查文章标题、发送人昵称/头像，XML 见 resources/mapper/NotificationMapper.xml。
 */
@Mapper
public interface NotificationMapper extends BaseMapper<Notification> {

    /**
     * 当前用户的通知分页，按创建时间倒序。
     */
    IPage<NotificationVO> selectNotificationPage(IPage<NotificationVO> page,
                                                 @Param("userId") Long userId,
                                                 @Param("unreadOnly") boolean unreadOnly);

    /**
     * 通知总数（与 {@link #selectNotificationPage} 同一套筛选条件）。
     */
    long selectNotificationCount(@Param("userId") Long userId, @Param("unreadOnly") boolean unreadOnly);
}
