package com.ssafy.mozzi.domain.gacha.service;

import org.springframework.stereotype.Component;

import com.ssafy.mozzi.domain.gacha.dto.CardResponseDto;
import com.ssafy.mozzi.domain.gacha.entity.MemberCard;
import com.ssafy.mozzi.domain.gacha.entity.MozziCard;

/** Builds the API's {@code Card}: the card itself, the member's copy of it, and its tier's exchange cost. */
@Component
public class CardMapper {

    private final GachaTierCatalog tierCatalog;
    private final GachaProperties properties;

    public CardMapper(GachaTierCatalog tierCatalog, GachaProperties properties) {
        this.tierCatalog = tierCatalog;
        this.properties = properties;
    }

    /** @param owned the member's copy, or {@code null} when it has none */
    public CardResponseDto toDto(MozziCard card, MemberCard owned) {
        return new CardResponseDto(
                card.getId(),
                card.getCode(),
                card.getName(),
                card.getTier(),
                card.getEmotion(),
                card.getSeries(),
                properties.imageUrl(card.getImageKey()),
                owned != null,
                owned == null ? 0 : owned.getOwnedCount(),
                owned != null && owned.isNew(),
                tierCatalog.get(card.getTier()).getExchangeCost());
    }

}
