package com.ssafy.mozzi.global.security;

import org.springframework.http.HttpStatus;

import com.ssafy.mozzi.global.exception.ErrorCode;

/**
 * Codes produced while authenticating an API request.
 *
 * <p>The app branches on these, so the distinctions are deliberate: only
 * {@link #ACCESS_TOKEN_EXPIRED} triggers a refresh, {@link #SESSION_REVOKED} sends the user
 * back to the login screen, and {@link #AUTH_SERVICE_UNAVAILABLE} must not cost the user
 * their tokens — a database outage is not a reason to log anyone out.
 */
public enum SecurityErrorCode implements ErrorCode {

    ACCESS_TOKEN_MISSING(HttpStatus.UNAUTHORIZED, "로그인이 필요해요."),
    ACCESS_TOKEN_INVALID(HttpStatus.UNAUTHORIZED, "다시 로그인해 주세요."),
    ACCESS_TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "다시 로그인해 주세요."),
    SESSION_REVOKED(HttpStatus.UNAUTHORIZED, "다른 곳에서 로그인되어 로그아웃되었어요."),
    AUTH_SERVICE_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "잠시 후에 다시 시도해 주세요.");

    private final HttpStatus status;
    private final String message;

    SecurityErrorCode(HttpStatus status, String message) {
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
