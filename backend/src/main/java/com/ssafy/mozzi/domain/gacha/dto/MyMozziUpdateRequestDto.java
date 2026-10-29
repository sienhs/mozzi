package com.ssafy.mozzi.domain.gacha.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Body of {@code PUT /members/me/mozzis/{emotion}}.
 *
 * @param cardId an active card the member owns, of that emotion
 */
public record MyMozziUpdateRequestDto(@NotNull(message = "모찌를 골라 주세요.") Long cardId) {
}
