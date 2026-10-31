package com.blog.config;

import com.blog.constant.TimeConstants;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateDeserializer;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalDateTimeDeserializer;
import com.fasterxml.jackson.datatype.jsr310.deser.LocalTimeDeserializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateSerializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalDateTimeSerializer;
import com.fasterxml.jackson.datatype.jsr310.ser.LocalTimeSerializer;
import org.springframework.boot.autoconfigure.jackson.Jackson2ObjectMapperBuilderCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.TimeZone;

/**
 * Jackson 时间序列化配置：接口统一输出 yyyy-MM-dd HH:mm:ss 格式字符串。
 */
@Configuration
public class JacksonConfig {

    private static final DateTimeFormatter DATE_TIME_FORMATTER =
            DateTimeFormatter.ofPattern(TimeConstants.DATE_TIME_PATTERN);
    private static final DateTimeFormatter DATE_FORMATTER =
            DateTimeFormatter.ofPattern(TimeConstants.DATE_PATTERN);
    private static final DateTimeFormatter TIME_FORMATTER =
            DateTimeFormatter.ofPattern(TimeConstants.TIME_PATTERN);

    @Bean
    public Jackson2ObjectMapperBuilderCustomizer jacksonCustomizer() {
        return builder -> {
            builder.serializerByType(LocalDateTime.class, new LocalDateTimeSerializer(DATE_TIME_FORMATTER));
            builder.deserializerByType(LocalDateTime.class, new LocalDateTimeDeserializer(DATE_TIME_FORMATTER));
            builder.serializerByType(LocalDate.class, new LocalDateSerializer(DATE_FORMATTER));
            builder.deserializerByType(LocalDate.class, new LocalDateDeserializer(DATE_FORMATTER));
            builder.serializerByType(LocalTime.class, new LocalTimeSerializer(TIME_FORMATTER));
            builder.deserializerByType(LocalTime.class, new LocalTimeDeserializer(TIME_FORMATTER));
            builder.simpleDateFormat(TimeConstants.DATE_TIME_PATTERN);
            builder.timeZone(TimeZone.getTimeZone(TimeConstants.ZONE_NAME));
        };
    }
}
