package com.ssafy.mozzi.domain.image.exception;

import org.springframework.http.HttpStatus;

import com.ssafy.mozzi.global.exception.ErrorCode;

/**
 * Codes from {@code POST /diaries/{diaryId}/image}.
 */
public enum ImageErrorCode implements ErrorCode {

    IMAGE_ONLY_TODAY(HttpStatus.BAD_REQUEST, "그림일기는 그날에만 만들 수 있어요."),
    IMAGE_ALREADY_REQUESTED(HttpStatus.CONFLICT, "이미 그림을 그리고 있거나 완성했어요."),
    RETRY_LIMIT_EXCEEDED(HttpStatus.TOO_MANY_REQUESTS, "그림은 세 번까지만 그릴 수 있어요.");

    private final HttpStatus status;
    private final String message;

    ImageErrorCode(HttpStatus status, String message) {
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
