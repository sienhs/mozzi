package com.ssafy.mozzi.domain.gacha.exception;

import org.springframework.http.HttpStatus;

import com.ssafy.mozzi.global.exception.ErrorCode;

/**
 * Codes from {@code /gacha} and the my page's mozzi picks.
 */
public enum GachaErrorCode implements ErrorCode {

    NOT_ENOUGH_TICKETS(HttpStatus.CONFLICT, "뽑기권이 부족해요."),
    NOT_ENOUGH_SHARDS(HttpStatus.CONFLICT, "별조각이 부족해요."),
    CARD_ALREADY_OWNED(HttpStatus.CONFLICT, "이미 가지고 있는 모찌예요."),
    CARD_NOT_EXCHANGEABLE(HttpStatus.CONFLICT, "별조각으로 교환할 수 없는 모찌예요."),
    /** Picking a mozzi for an emotion: the member does not have the card, or it is retired. */
    CARD_NOT_OWNED(HttpStatus.CONFLICT, "가지고 있는 모찌만 고를 수 있어요."),
    /** Picking a mozzi for an emotion: the card belongs to another emotion. */
    CARD_EMOTION_MISMATCH(HttpStatus.BAD_REQUEST, "이 감정의 모찌만 고를 수 있어요."),
    /** The drawn tier has no active card: a card registration mistake, not the member's. */
    GACHA_UNAVAILABLE(HttpStatus.SERVICE_UNAVAILABLE, "지금은 뽑기를 할 수 없어요. 잠시 후에 다시 시도해 주세요.");

    private final HttpStatus status;
    private final String message;

    GachaErrorCode(HttpStatus status, String message) {
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
