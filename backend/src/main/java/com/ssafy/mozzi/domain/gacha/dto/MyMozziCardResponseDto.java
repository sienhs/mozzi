package com.ssafy.mozzi.domain.gacha.dto;

import com.ssafy.mozzi.domain.gacha.entity.CardTier;

/** The mozzi picked for an emotion, on the my page. */
public record MyMozziCardResponseDto(Long cardId, String name, CardTier tier, String imageUrl) {
}
