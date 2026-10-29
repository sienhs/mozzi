package com.ssafy.mozzi.domain.gacha.dto;

import java.util.List;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Body of {@code POST /gacha/collection/seen}.
 *
 * @param cardIds cards the member has now seen; ids it does not own are ignored
 */
public record CardSeenRequestDto(
        @NotNull(message = "카드를 골라 주세요.")
        @Size(max = 500, message = "한 번에 500장까지 보낼 수 있어요.") List<@NotNull Long> cardIds) {
}
