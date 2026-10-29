package com.ssafy.mozzi.domain.gacha.dto;

import jakarta.validation.constraints.NotNull;

/** Body of {@code POST /gacha/exchanges}. */
public record GachaExchangeRequestDto(@NotNull(message = "교환할 모찌를 골라 주세요.") Long cardId) {
}
