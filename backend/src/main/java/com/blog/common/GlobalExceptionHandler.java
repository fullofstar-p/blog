package com.blog.common;

import jakarta.validation.ConstraintViolationException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.servlet.NoHandlerFoundException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/**
 * 全局异常处理：把各类异常统一转换为 { code, message, data }。
 * 说明：业务码 401/403 同步返回对应 HTTP 状态，便于前端拦截器据此跳转登录页。
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /** 业务异常 */
    @ExceptionHandler(BusinessException.class)
    public ResponseEntity<Result<Void>> handleBusiness(BusinessException e) {
        HttpStatus httpStatus = switch (e.getCode()) {
            case 401 -> HttpStatus.UNAUTHORIZED;
            case 403 -> HttpStatus.FORBIDDEN;
            default -> HttpStatus.OK;
        };
        return ResponseEntity.status(httpStatus).body(Result.fail(e.getCode(), e.getMessage()));
    }

    /** @Valid 参数校验失败（含 @RequestBody 与表单） */
    @ExceptionHandler(BindException.class)
    public Result<Void> handleBind(BindException e) {
        FieldError fieldError = e.getBindingResult().getFieldError();
        String message = fieldError != null && fieldError.getDefaultMessage() != null
                ? fieldError.getDefaultMessage() : "参数校验失败";
        return Result.fail(ResultCode.BAD_REQUEST, message);
    }

    /** @Validated 路径/查询参数校验失败 */
    @ExceptionHandler(ConstraintViolationException.class)
    public Result<Void> handleConstraint(ConstraintViolationException e) {
        String message = e.getConstraintViolations().stream()
                .findFirst()
                .map(v -> v.getMessage())
                .orElse("参数校验失败");
        return Result.fail(ResultCode.BAD_REQUEST, message);
    }

    /** 缺少必填请求参数 */
    @ExceptionHandler(MissingServletRequestParameterException.class)
    public Result<Void> handleMissingParam(MissingServletRequestParameterException e) {
        return Result.fail(ResultCode.BAD_REQUEST, "缺少参数：" + e.getParameterName());
    }

    /** 请求体格式错误（JSON 无法解析等） */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    public Result<Void> handleNotReadable(HttpMessageNotReadableException e) {
        return Result.fail(ResultCode.BAD_REQUEST, "请求体格式错误");
    }

    /** 上传文件超过限制 */
    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public Result<Void> handleMaxUpload(MaxUploadSizeExceededException e) {
        return Result.fail(ResultCode.BAD_REQUEST, "文件大小超过限制（最大 5MB）");
    }

    /** 无权限（方法级鉴权） */
    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Result<Void>> handleAccessDenied(AccessDeniedException e) {
        return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Result.fail(ResultCode.FORBIDDEN));
    }

    /** 静态资源 / 未知路径不存在：返回 404，不打 ERROR 日志（浏览器 favicon 等探测很常见） */
    @ExceptionHandler({NoResourceFoundException.class, NoHandlerFoundException.class})
    public ResponseEntity<Result<Void>> handleNotFound(Exception e) {
        log.debug("资源不存在：{}", e.getMessage());
        return ResponseEntity.status(HttpStatus.NOT_FOUND)
                .body(Result.fail(ResultCode.NOT_FOUND));
    }

    /** 兜底异常 */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Result<Void>> handleException(Exception e) {
        log.error("服务器内部错误", e);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                .body(Result.fail(ResultCode.ERROR));
    }
}
