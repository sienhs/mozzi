package com.ssafy.mozzi.global.exception;

import org.springframework.http.HttpStatus;

/**
 * Cross-cutting codes from API spec 1.3.
 *
 * <p>Authentication codes are not here: the app branches on finer distinctions (expired
 * vs. revoked vs. outage) than a single UNAUTHORIZED, so they live in
 * {@link com.ssafy.mozzi.global.security.SecurityErrorCode}.
 *
 * <p>{@code METHOD_NOT_ALLOWED}, {@code NOT_ACCEPTABLE} and {@code UNSUPPORTED_MEDIA_TYPE}
 * are not in the spec table yet. They are kept here because Spring raises them before any domain code runs, so
 * without a code of their own the framework's error body leaks through.
 */
public enum CommonErrorCode implements ErrorCode {

    INVALID_INPUT(HttpStatus.BAD_REQUEST, "입력값을 다시 확인해 주세요."),
    NOT_FOUND(HttpStatus.NOT_FOUND, "찾을 수 없어요."),
    METHOD_NOT_ALLOWED(HttpStatus.METHOD_NOT_ALLOWED, "요청을 처리하지 못했어요."),
    NOT_ACCEPTABLE(HttpStatus.NOT_ACCEPTABLE, "요청을 처리하지 못했어요."),
    UNSUPPORTED_MEDIA_TYPE(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "요청을 처리하지 못했어요."),
    IDEMPOTENCY_CONFLICT(HttpStatus.CONFLICT, "같은 요청이 이미 처리됐어요."),
    RATE_LIMITED(HttpStatus.TOO_MANY_REQUESTS, "잠시 후에 다시 시도해 주세요."),
    INTERNAL_ERROR(HttpStatus.INTERNAL_SERVER_ERROR, "잠시 후에 다시 시도해 주세요.");

    private final HttpStatus status;
    private final String message;

    CommonErrorCode(HttpStatus status, String message) {
        this.status = status;
        this.message = message;
    }

    @Override
    public HttpStatus status() {
        return status;
    }

    @Override
    public String code() {
        return name();
    }

    @Override
    public String message() {
        return message;
    }

}
