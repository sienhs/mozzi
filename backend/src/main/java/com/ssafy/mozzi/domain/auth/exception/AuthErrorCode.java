package com.ssafy.mozzi.domain.auth.exception;

import org.springframework.http.HttpStatus;

import com.ssafy.mozzi.global.exception.ErrorCode;

/**
 * Codes from the login, sign-up and refresh endpoints.
 *
 * <p>Codes raised while authenticating an ordinary request (expired access token, revoked
 * session, outage) live in {@link com.ssafy.mozzi.global.security.SecurityErrorCode}.
 */
public enum AuthErrorCode implements ErrorCode {

    GOOGLE_TOKEN_INVALID(HttpStatus.UNAUTHORIZED, "Google 로그인을 다시 시도해 주세요."),
    /** Sign-up needs an email Google has verified; the identity itself is only the sub. */
    GOOGLE_EMAIL_UNAVAILABLE(HttpStatus.BAD_REQUEST, "이메일이 확인된 Google 계정으로 로그인해 주세요."),
    REFRESH_TOKEN_INVALID(HttpStatus.UNAUTHORIZED, "다시 로그인해 주세요."),
    REFRESH_TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "다시 로그인해 주세요."),
    SIGNUP_TOKEN_INVALID(HttpStatus.UNAUTHORIZED, "Google 로그인부터 다시 진행해 주세요."),
    SIGNUP_TOKEN_EXPIRED(HttpStatus.UNAUTHORIZED, "Google 로그인부터 다시 진행해 주세요."),
    ACCOUNT_ALREADY_REGISTERED(HttpStatus.CONFLICT, "이미 가입된 계정이에요. Google 로그인을 다시 진행해 주세요.");

    private final HttpStatus status;
    private final String message;

    AuthErrorCode(HttpStatus status, String message) {
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
