package com.ssafy.mozzi.domain.search.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.ssafy.mozzi.domain.diary.entity.ActivityCode;
import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.search.repository.SearchCriteria;
import com.ssafy.mozzi.domain.search.service.QuestionInterpreter.Intent;
import com.ssafy.mozzi.integration.gms.GmsUnavailableException;

/** What {@link QuestionInterpreter#normalize} repairs in an answer the schema let through. */
class QuestionInterpreterTest {

    private static final LocalDate TODAY = LocalDate.of(2026, 10, 28);

    @Test
    void reversedRangeIsSwapped() {
        SearchCriteria criteria = normalize("2026-10-25", "2026-10-19", null);

        assertThat(criteria.from()).isEqualTo("2026-10-19");
        assertThat(criteria.to()).isEqualTo("2026-10-25");
    }

    /** "이번 달" read as the whole month: no diary can exist after today. */
    @Test
    void endInTheFutureStopsAtToday() {
        assertThat(normalize("2026-10-01", "2026-10-31", null).to()).isEqualTo(TODAY);
    }

    @Test
    void blankKeywordIsNoKeyword() {
        assertThat(normalize(null, null, "   ").keyword()).isNull();
        assertThat(normalize(null, null, " 칭찬 ").keyword()).isEqualTo("칭찬");
    }

    @Test
    void ramblingKeywordIsCut() {
        assertThat(normalize(null, null, "가".repeat(80)).keyword()).hasSize(QuestionInterpreter.KEYWORD_MAX_LENGTH);
    }

    @Test
    void repeatedCodesAreDropped() {
        SearchCriteria criteria = QuestionInterpreter.normalize(new QuestionInterpreter.Answer(
                null, null, List.of(Emotion.CALM, Emotion.CALM), List.of(ActivityCode.REST, ActivityCode.REST), null,
                Intent.LIST), TODAY);

        assertThat(criteria.emotions()).containsExactly(Emotion.CALM);
        assertThat(criteria.activities()).containsExactly(ActivityCode.REST);
    }

    /** Querying with a made-up date would answer from the wrong days. */
    @Test
    void dateThatIsNotADateIsUnusable() {
        assertThatThrownBy(() -> normalize("지난주 월요일", null, null))
                .isInstanceOf(GmsUnavailableException.class);
    }

    private static SearchCriteria normalize(String from, String to, String keyword) {
        return QuestionInterpreter.normalize(
                new QuestionInterpreter.Answer(from, to, List.of(), List.of(), keyword, Intent.LIST), TODAY);
    }

}
