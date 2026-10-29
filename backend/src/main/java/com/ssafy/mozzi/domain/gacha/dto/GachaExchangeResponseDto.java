package com.ssafy.mozzi.domain.gacha.dto;

/**
 * {@code 201} body of {@code POST /gacha/exchanges}. Replayed as stored for a repeated
 * {@code Idempotency-Key}.
 *
 * @param card       the card obtained, NEW in the collection
 * @param shardCount star shards left
 */
public record GachaExchangeResponseDto(CardResponseDto card, int shardsSpent, int shardCount) {
}
