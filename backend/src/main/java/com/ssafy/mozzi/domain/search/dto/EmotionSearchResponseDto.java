package com.ssafy.mozzi.domain.search.dto;

import java.time.LocalDate;
import java.util.List;

import com.ssafy.mozzi.domain.diary.dto.DiaryDetailResponseDto;
import com.ssafy.mozzi.domain.diary.dto.DiarySummaryResponseDto;
import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.search.entity.SearchResultType;
import com.ssafy.mozzi.domain.search.repository.SearchCriteria;

/**
 * {@code POST /emotion-search} (S-02, E-04).
 *
 * @param resultType never {@link SearchResultType#FAILED}; a failure answers 503
 * @param answer     {@code null} for {@link SearchResultType#EMPTY}
 * @param featured   the big card; {@code null} unless {@link SearchResultType#FOUND}
 * @param diaries    the rows below it, best match first; empty unless
 *                   {@link SearchResultType#FOUND}
 */
public record EmotionSearchResponseDto(
        Long searchId,
        String question,
        SearchResultType resultType,
        String answer,
        InterpretedFilter interpretedFilter,
        Stats stats,
        DiaryDetailResponseDto featured,
        List<DiarySummaryResponseDto> diaries) {

    /** What the server read from the question, so the app can show why these diaries. */
    public record InterpretedFilter(
            LocalDate from,
            LocalDate to,
            List<Emotion> emotions,
            String keyword) {

        public static InterpretedFilter of(SearchCriteria criteria) {
            return new InterpretedFilter(criteria.from(), criteria.to(), criteria.emotions(), criteria.keyword());
        }

    }

    /**
     * @param matchedCount  diaries the answer is about
     * @param emotionCounts per emotion, most frequent first; {@code null} unless
     *                      {@link SearchResultType#STATS_ONLY}
     */
    public record Stats(long matchedCount, List<EmotionCount> emotionCounts) {
    }

    public record EmotionCount(Emotion emotion, long count) {
    }

}
