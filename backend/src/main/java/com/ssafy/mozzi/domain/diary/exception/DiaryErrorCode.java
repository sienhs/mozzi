package com.ssafy.mozzi.domain.diary.exception;

import org.springframework.http.HttpStatus;

import com.ssafy.mozzi.global.exception.ErrorCode;

/**
 * Codes from {@code POST /diaries} and {@code PATCH /diaries/{diaryId}/content}.
 */
public enum DiaryErrorCode implements ErrorCode {

    DIARY_ALREADY_EXISTS(HttpStatus.CONFLICT, "오늘은 이미 기록을 남겼어요."),
    DIARY_CONTENT_ALREADY_WRITTEN(HttpStatus.CONFLICT, "이미 한 줄 일기를 남겼어요.");

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
