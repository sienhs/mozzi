package com.ssafy.mozzi.domain.search.service;

import java.time.LocalDate;
import java.util.List;
import java.util.Set;
import java.util.function.Predicate;

import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.search.repository.SearchDiaryQuery.DayEmotion;

/**
 * Step ③ of emotion search: how the member's week went, read from the database so the
 * answer can mention a change without the model remembering anything (spec
 * emotion-search.md).
 *
 * <p>Runs and streaks are worked out here rather than left to the model: a cheap model
 * handed a list of dates miscounts consecutive days easily.
 *
 * @param recordedDays the emotion of each recorded day this week, oldest first
 * @param searches     the emotions this week's earlier questions asked about, oldest first
 */
public record WeeklyContext(List<DayEmotion> recordedDays, List<SearchedEmotions> searches) {

    private static final Set<Emotion> NEGATIVE = Set.of(Emotion.SAD, Emotion.ANGRY);

    public record SearchedEmotions(LocalDate date, List<Emotion> emotions) {
    }

    /**
     * @param days how many days in a row, ending with the latest recorded day
     */
    public record Streak(Emotion emotion, int days) {
    }

    public WeeklyContext {
        recordedDays = List.copyOf(recordedDays);
        searches = List.copyOf(searches);
    }

    /** The same emotion on consecutive days up to the latest record, or {@code null} under two days. */
    public Streak streak() {
        if (recordedDays.isEmpty()) {
            return null;
        }
        DayEmotion latest = recordedDays.get(recordedDays.size() - 1);
        int days = run(day -> day.emotion() == latest.emotion());
        return days >= 2 ? new Streak(latest.emotion(), days) : null;
    }

    /**
     * Sad or angry on at least two consecutive days up to the latest record. The answer then
     * leaves out any comparison (spec): pointing at a low week is the kind of remark the
     * service must not make.
     */
    public boolean negativeRun() {
        return run(day -> NEGATIVE.contains(day.emotion())) >= 2;
    }

    private int run(Predicate<DayEmotion> matches) {
        int days = 0;
        LocalDate expected = null;
        for (int i = recordedDays.size() - 1; i >= 0; i--) {
            DayEmotion day = recordedDays.get(i);
            if (expected != null && !day.recordDate().equals(expected)) {
                break;
            }
            if (!matches.test(day)) {
                break;
            }
            days++;
            expected = day.recordDate().minusDays(1);
        }
        return days;
    }

}
