package com.ssafy.mozzi.domain.gacha.dto;

import java.util.List;

/**
 * {@code 201} body of {@code POST /gacha/draws}. Replayed as stored for a repeated
 * {@code Idempotency-Key}.
 *
 * @param results    in the order drawn
 * @param collection progress after this draw, so the summary needs no second request
 */
public record GachaDrawResponseDto(
        Long drawId,
        List<Result> results,
        int ticketCount,
        int shardCount,
        CollectionProgressDto collection) {

    /**
     * @param firstAcquired the first copy the member got: "새로운 모찌"
     * @param shardsGained  star shards for a duplicate, {@code 0} for a first copy
     */
    public record Result(CardResponseDto card, boolean firstAcquired, int shardsGained) {
    }

}
