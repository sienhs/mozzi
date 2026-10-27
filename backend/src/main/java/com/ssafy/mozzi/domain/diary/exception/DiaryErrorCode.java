package com.ssafy.mozzi.domain.diary.exception;

import org.springframework.http.HttpStatus;

import com.ssafy.mozzi.global.exception.ErrorCode;

/**
 * Codes from API spec 4.4 {@code POST /diaries}.
 */
public enum DiaryErrorCode implements ErrorCode {

    INVALID_RECORD_DATE(HttpStatus.BAD_REQUEST, "오늘의 기록만 남길 수 있어요."),
    DIARY_ALREADY_EXISTS(HttpStatus.CONFLICT, "오늘은 이미 기록을 남겼어요.");

    private final HttpStatus status;
    private final String message;

    DiaryErrorCode(HttpStatus status, String message) {
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
