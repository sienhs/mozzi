package com.ssafy.mozzi.domain.search.service;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.search.repository.SearchDiaryQuery.DayEmotion;

class WeeklyContextTest {

    private static final LocalDate MONDAY = LocalDate.of(2026, 10, 26);

    @Test
    void streakCountsTheSameEmotionBackFromTheLatestDay() {
        WeeklyContext week = week(
                day(0, Emotion.HAPPY), day(1, Emotion.CALM), day(2, Emotion.CALM), day(3, Emotion.CALM));

        assertThat(week.streak()).isEqualTo(new WeeklyContext.Streak(Emotion.CALM, 3));
    }

    /** A skipped day breaks the run; "3일 연속" must mean three calendar days. */
    @Test
    void aMissingDayBreaksTheStreak() {
        WeeklyContext week = week(day(0, Emotion.CALM), day(2, Emotion.CALM));

        assertThat(week.streak()).isNull();
    }

    @Test
    void oneDayIsNoStreak() {
        assertThat(week(day(0, Emotion.SAD)).streak()).isNull();
        assertThat(week().streak()).isNull();
    }

    @Test
    void sadAndAngryTogetherAreANegativeRun() {
        assertThat(week(day(0, Emotion.HAPPY), day(1, Emotion.SAD), day(2, Emotion.ANGRY)).negativeRun()).isTrue();
    }

    /** Only the run up to the latest day counts: a low patch earlier in the week is over. */
    @Test
    void aLowPatchThatEndedIsNoNegativeRun() {
        assertThat(week(day(0, Emotion.SAD), day(1, Emotion.SAD), day(2, Emotion.HAPPY)).negativeRun()).isFalse();
        assertThat(week(day(0, Emotion.SAD)).negativeRun()).isFalse();
    }

    private static WeeklyContext week(DayEmotion... days) {
        return new WeeklyContext(List.of(days), List.of());
    }

    private static DayEmotion day(int offset, Emotion emotion) {
        return new DayEmotion(MONDAY.plusDays(offset), emotion);
    }

}
