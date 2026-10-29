package com.ssafy.mozzi.domain.gacha.dto;

import java.time.OffsetDateTime;

import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.gacha.entity.CardTier;

/**
 * A card on the owned mozzi screen.
 *
 * @param equipped whether it is the member's pick for its emotion
 */
public record OwnedMozziResponseDto(
        Long cardId,
        String name,
        CardTier tier,
        Emotion emotion,
        String imageUrl,
        OffsetDateTime acquiredAt,
        boolean equipped) {
}
