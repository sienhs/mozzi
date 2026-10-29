package com.ssafy.mozzi.domain.icon.exception;

import org.springframework.http.HttpStatus;

import com.ssafy.mozzi.global.exception.ErrorCode;

public enum MyIconErrorCode implements ErrorCode {

    MY_ICON_LIMIT_EXCEEDED(HttpStatus.CONFLICT, "아이콘은 카테고리마다 30개까지 만들 수 있어요.");

    private final HttpStatus status;
    private final String message;

    MyIconErrorCode(HttpStatus status, String message) {
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
