package com.ssafy.mozzi.domain.gacha.dto;

import java.util.List;

/**
 * {@code GET /members/me/mozzis}.
 *
 * @param count the cards after the filters
 */
public record OwnedMozziListResponseDto(int count, List<OwnedMozziResponseDto> cards) {
}
