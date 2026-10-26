package com.blog.common;

import lombok.Getter;

/**
 * 业务异常：由全局异常处理器转换为统一响应体。
 */
@Getter
public class BusinessException extends RuntimeException {

    /** 业务码，对应 ResultCode */
    private final int code;

    public BusinessException(ResultCode resultCode) {
        super(resultCode.getMessage());
        this.code = resultCode.getCode();
    }

    public BusinessException(ResultCode resultCode, String message) {
        super(message);
        this.code = resultCode.getCode();
    }

    public BusinessException(int code, String message) {
        super(message);
        this.code = code;
    }
}
