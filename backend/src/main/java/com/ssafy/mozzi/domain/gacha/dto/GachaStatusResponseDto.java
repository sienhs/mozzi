package com.ssafy.mozzi.domain.gacha.dto;

/** {@code GET /gacha/status}. */
public record GachaStatusResponseDto(int ticketCount, int shardCount, CollectionProgressDto collection) {
}
