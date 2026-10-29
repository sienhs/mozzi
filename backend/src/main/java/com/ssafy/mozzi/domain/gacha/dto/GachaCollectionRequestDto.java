package com.ssafy.mozzi.domain.gacha.dto;

/**
 * Query of {@code GET /gacha/collection}. Both filters are optional.
 *
 * @param owned  {@code false} for the cards the member lacks, {@code true} for the ones it has
 * @param series one series, such as {@code 과일 모찌}
 */
public record GachaCollectionRequestDto(Boolean owned, String series) {
}
