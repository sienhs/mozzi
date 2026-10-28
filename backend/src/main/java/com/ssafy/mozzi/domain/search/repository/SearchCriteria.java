package com.ssafy.mozzi.domain.search.repository;

import java.time.LocalDate;
import java.util.List;

import com.ssafy.mozzi.domain.diary.entity.ActivityCode;
import com.ssafy.mozzi.domain.diary.entity.Emotion;

/**
 * The conditions read from a question; {@code interpretedFilter} in the response.
 *
 * @param from       inclusive, or {@code null} for no lower bound
 * @param to         inclusive, or {@code null} for no upper bound
 * @param emotions   any of these; empty means every emotion
 * @param activities diaries with at least one of these; empty means no activity condition
 * @param keyword    what the question asks about beyond the other conditions ("칭찬"), or
 *                   {@code null}. Ranks diaries by meaning; it never filters them out
 */
public record SearchCriteria(
        LocalDate from,
        LocalDate to,
        List<Emotion> emotions,
        List<ActivityCode> activities,
        String keyword) {

    public SearchCriteria {
        emotions = List.copyOf(emotions);
        activities = List.copyOf(activities);
    }

}
