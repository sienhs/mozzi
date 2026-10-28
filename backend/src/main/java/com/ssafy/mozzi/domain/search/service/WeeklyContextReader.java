package com.ssafy.mozzi.domain.search.service;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.mozzi.domain.search.dto.EmotionSearchResponseDto.InterpretedFilter;
import com.ssafy.mozzi.domain.search.entity.EmotionSearch;
import com.ssafy.mozzi.domain.search.repository.EmotionSearchRepository;
import com.ssafy.mozzi.domain.search.repository.SearchDiaryQuery;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

/** Reads {@link WeeklyContext}: the seven days ending today, today included. */
@Component
public class WeeklyContextReader {

    static final int DAYS = 7;

    private final SearchDiaryQuery searchDiaryQuery;
    private final EmotionSearchRepository emotionSearchRepository;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public WeeklyContextReader(SearchDiaryQuery searchDiaryQuery, EmotionSearchRepository emotionSearchRepository,
            ObjectMapper objectMapper, Clock clock) {
        this.searchDiaryQuery = searchDiaryQuery;
        this.emotionSearchRepository = emotionSearchRepository;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public WeeklyContext read(Long memberId, LocalDate today) {
        LocalDate first = today.minusDays(DAYS - 1);
        OffsetDateTime since = first.atStartOfDay(clock.getZone()).toOffsetDateTime();

        List<WeeklyContext.SearchedEmotions> searches = new ArrayList<>();
        for (EmotionSearch search : emotionSearchRepository
                .findByMemberIdAndCreatedAtGreaterThanEqualOrderByCreatedAt(memberId, since)) {
            InterpretedFilter filter = filterOf(search);
            if (filter != null && !filter.emotions().isEmpty()) {
                searches.add(new WeeklyContext.SearchedEmotions(
                        search.getCreatedAt().atZoneSameInstant(clock.getZone()).toLocalDate(), filter.emotions()));
            }
        }
        return new WeeklyContext(searchDiaryQuery.emotionsBetween(memberId, first, today), searches);
    }

    /** {@code null} for a question that failed before it was interpreted. */
    private InterpretedFilter filterOf(EmotionSearch search) {
        if (search.getInterpretedFilter() == null) {
            return null;
        }
        try {
            return objectMapper.readValue(search.getInterpretedFilter(), InterpretedFilter.class);
        } catch (JacksonException e) {
            // Written by this application, so this means the shape changed since. Losing one
            // old search from the context is better than failing today's question over it.
            return null;
        }
    }

}
