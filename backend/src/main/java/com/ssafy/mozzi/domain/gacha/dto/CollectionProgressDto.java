package com.ssafy.mozzi.domain.gacha.dto;

/**
 * {@code collection} of the gacha responses.
 *
 * @param owned active cards the member has
 * @param total active cards
 */
public record CollectionProgressDto(long owned, long total) {
}
