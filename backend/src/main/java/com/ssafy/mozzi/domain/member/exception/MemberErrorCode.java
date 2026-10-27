package com.ssafy.mozzi.domain.member.exception;

import org.springframework.http.HttpStatus;

import com.ssafy.mozzi.global.exception.ErrorCode;

public enum MemberErrorCode implements ErrorCode {

    NICKNAME_DUPLICATED(HttpStatus.CONFLICT, "이미 사용 중인 닉네임이에요."),
    TERMS_AGREEMENT_REQUIRED(HttpStatus.BAD_REQUEST, "필수 약관에 동의해 주세요.");

    private final HttpStatus status;
    private final String message;

    MemberErrorCode(HttpStatus status, String message) {
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
