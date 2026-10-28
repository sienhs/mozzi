package com.ssafy.mozzi.domain.search.exception;

import org.springframework.http.HttpStatus;

import com.ssafy.mozzi.global.exception.ErrorCode;

/**
 * Codes from API spec emotion-search.md {@code POST /emotion-search}. {@code RATE_LIMITED}
 * is the shared {@link com.ssafy.mozzi.global.exception.CommonErrorCode#RATE_LIMITED}.
 */
public enum SearchErrorCode implements ErrorCode {

    /** E-05. The app offers "다시 물어보기", which sends the same question again. */
    SEARCH_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "지금은 답을 찾지 못했어요.");

    private final HttpStatus status;
    private final String message;

    SearchErrorCode(HttpStatus status, String message) {
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
