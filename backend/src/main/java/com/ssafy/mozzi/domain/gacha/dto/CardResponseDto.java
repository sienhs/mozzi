package com.ssafy.mozzi.domain.gacha.dto;

import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.gacha.entity.CardTier;

/**
 * {@code Card} of gacha.md. Cards the member lacks carry their name and picture too: the
 * exchange screen shows them, and the collection hides them by {@code owned}.
 *
 * @param ownedCount   times obtained, {@code 0} when not owned
 * @param isNew        obtained and not yet opened in the collection
 * @param exchangeCost star shards to exchange for it, {@code null} below legendary
 */
public record CardResponseDto(
        Long cardId,
        String code,
        String name,
        CardTier tier,
        Emotion emotion,
        String series,
        String imageUrl,
        boolean owned,
        int ownedCount,
        boolean isNew,
        Integer exchangeCost) {
}
