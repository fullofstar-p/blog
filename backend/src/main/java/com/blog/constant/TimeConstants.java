package com.blog.constant;

import java.time.ZoneId;
import java.time.format.DateTimeFormatter;

/**
 * 时间常量：站点时区与统一的时间格式。
 */
public final class TimeConstants {

    private TimeConstants() {
    }

    /** 站点时区：东八区 */
    public static final String ZONE_NAME = "Asia/Shanghai";

    /** 站点时区 */
    public static final ZoneId ZONE_ID = ZoneId.of(ZONE_NAME);

    /** 日期时间格式 */
    public static final String DATE_TIME_PATTERN = "yyyy-MM-dd HH:mm:ss";

    /** 日期格式 */
    public static final String DATE_PATTERN = "yyyy-MM-dd";

    /** 时间格式 */
    public static final String TIME_PATTERN = "HH:mm:ss";

    /** 日期格式的格式化器（线程安全） */
    public static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern(DATE_PATTERN);
}
