package com.ssafy.mozzi.domain.gacha.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;

/**
 * Body of {@code POST /gacha/draws}.
 *
 * @param count tickets to spend, one card each. The app sends 1, 10, or every ticket it has
 *              when that is fewer than 10.
 */
public record GachaDrawRequestDto(
        @NotNull(message = "뽑을 장수를 정해 주세요.")
        @Min(value = 1, message = "1장 이상 뽑아야 해요.")
        @Max(value = 10, message = "한 번에 10장까지 뽑을 수 있어요.") Integer count) {
}
