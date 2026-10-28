package com.ssafy.mozzi.domain.search.repository;

import java.time.LocalDate;
import java.util.List;

import com.ssafy.mozzi.domain.diary.entity.Emotion;

/**
 * The conditions read from a question; {@code interpretedFilter} in the response.
 *
 * <p>There is no activity condition: activities became icons each member names freely
 * (S15P31D102-110), so there is no fixed code to filter by. Icon names are part of the
 * embedded text instead, so "엄마랑" still ranks the right diaries through {@link #keyword}.
 *
 * @param from     inclusive, or {@code null} for no lower bound
 * @param to       inclusive, or {@code null} for no upper bound
 * @param emotions any of these; empty means every emotion
 * @param keyword  what the question asks about beyond the other conditions ("칭찬"), or
 *                 {@code null}. Ranks diaries by meaning; it never filters them out
 */
public record SearchCriteria(
        LocalDate from,
        LocalDate to,
        List<Emotion> emotions,
        String keyword) {

    public SearchCriteria {
        emotions = List.copyOf(emotions);
    }

}
