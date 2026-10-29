package com.ssafy.mozzi.domain.gacha.dto;

import java.util.List;

/**
 * {@code GET /gacha/collection}.
 *
 * @param owned progress over every active card, whatever the filters
 * @param total active cards, whatever the filters
 * @param cards the filtered cards, rarest tier first, then by {@code code}
 */
public record GachaCollectionResponseDto(long owned, long total, int shardCount, List<CardResponseDto> cards) {
}
