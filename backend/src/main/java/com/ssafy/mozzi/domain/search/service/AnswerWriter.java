package com.ssafy.mozzi.domain.search.service;

import java.time.LocalDate;
import java.time.format.TextStyle;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.search.repository.SearchCriteria;
import com.ssafy.mozzi.domain.search.repository.SearchDiaryQuery.Candidate;
import com.ssafy.mozzi.domain.search.repository.SearchDiaryQuery.DayEmotion;
import com.ssafy.mozzi.domain.search.repository.SearchDiaryQuery.EmotionCount;
import com.ssafy.mozzi.integration.gms.GmsLlmClient;
import com.ssafy.mozzi.integration.gms.GmsPrompt;
import com.ssafy.mozzi.integration.gms.GmsUnavailableException;

/**
 * Step ④ of emotion search: one or two sentences, written from the diaries found and the
 * weekly context only (spec emotion-search.md).
 *
 * <p>The model names the diaries it relied on. An id outside the candidates means it wrote
 * about something it was not given, so the answer is rejected rather than shown.
 */
@Component
public class AnswerWriter {

    /**
     * {@code emotion_search.answer} is varchar(500), less room for the count sentence
     * {@link #withCount} puts in front.
     */
    static final int ANSWER_MAX_LENGTH = 450;

    /**
     * Everything the answer may be based on.
     *
     * @param candidates     diaries found, best match first; empty for a stats question
     * @param matchedCount   diaries matching the conditions, counted by SQL
     * @param emotionCounts  per emotion; only for a stats question
     * @param pickRelevant   the conditions carried a keyword, so the candidates are ranked,
     *                       not filtered, and the model chooses which ones the question is
     *                       about
     */
    public record Material(
            String question,
            LocalDate today,
            SearchCriteria criteria,
            List<Candidate> candidates,
            long matchedCount,
            List<EmotionCount> emotionCounts,
            boolean pickRelevant,
            WeeklyContext weekly) {
    }

    /** The model's answer, bound from {@link #SCHEMA}. */
    public record Answer(String answer, List<Long> diaryIds) {
    }

    static final Map<String, Object> SCHEMA = Map.of(
            "type", "object",
            "additionalProperties", false,
            "required", List.of("answer", "diaryIds"),
            "properties", Map.of(
                    "answer", Map.of("type", "string"),
                    "diaryIds", Map.of("type", "array", "items", Map.of("type", "integer"))));

    private static final String INSTRUCTIONS = """
            너는 일기 앱 '모찌'의 기록 도우미다. 사용자가 자기 일기에 대해 물으면 주어진 자료만 근거로 답한다.
            사용자는 하루에 한 번 감정을 고르고, 그 감정의 얼굴을 한 '모찌'와 함께 기록한다.

            - answer: 한국어 존댓말로 한두 문장, 150자 이내로 쓴다. 담백하고 따뜻하게 쓰고 이모지는 쓰지 않는다.
              예: "10월에 평온 모찌를 고른 날이 5일 있었어요. 가족과 함께한 기록이 자주 보였어요."
            - 자료에 없는 사실·날짜·횟수를 지어내지 않는다. 숫자는 [통계]의 숫자를 그대로 쓴다.
              [고르기]가 있으면 기록이 몇 개인지, 몇 번인지 쓰지 않는다(개수는 따로 붙는다).
              고른 기록의 내용만 말한다.
            - diaryIds: 답의 근거가 된 기록의 id. [찾은 기록]에 있는 id만 쓴다.
              [고르기]가 있으면 질문 내용과 관련 있는 기록만 고르고, 관련 있는 기록이 없으면 []로 둔다.
              [고르기]가 없으면 []로 둔다.
            - [이번 주]의 감정이나 지난 검색이 이번 질문과 다르면 자연스럽게 한마디 덧붙여도 된다.
              예: "지난번엔 행복했던 날을 찾으셨는데, 오늘은 조금 다른 날을 떠올리고 계시네요."
            - 감정 변화를 평가하거나 진단하지 않는다. "우울하신가 봐요", "괜찮으세요?" 같은 말은 쓰지 않는다.
            - [주의]가 있으면 이번 주와 비교하거나 변화를 짚는 문장을 쓰지 않고 담담하게 답한다.
            """;

    private final GmsLlmClient llmClient;

    public AnswerWriter(GmsLlmClient llmClient) {
        this.llmClient = llmClient;
    }

    /**
     * @throws GmsUnavailableException no usable answer, including one that cites a diary it
     *                                 was not given or does not fit the column
     */
    public Answer write(Material material) {
        Answer answer = llmClient.respond(
                new GmsPrompt(INSTRUCTIONS, input(material), "search_answer", SCHEMA), Answer.class);

        // See QuestionInterpreter#requireShape for why the schema alone is not trusted.
        if (answer.diaryIds() == null || answer.diaryIds().stream().anyMatch(Objects::isNull)) {
            throw new GmsUnavailableException("answer breaks the schema");
        }
        String text = answer.answer() == null ? "" : answer.answer().strip();
        if (text.isEmpty()) {
            throw new GmsUnavailableException("answer is blank");
        }
        if (text.length() > ANSWER_MAX_LENGTH) {
            throw new GmsUnavailableException("answer is " + text.length() + " characters");
        }
        Set<Long> given = material.candidates().stream().map(Candidate::diaryId).collect(Collectors.toSet());
        List<Long> cited = answer.diaryIds().stream().distinct().toList();
        if (!given.containsAll(cited)) {
            Set<Long> unknown = new HashSet<>(cited);
            unknown.removeAll(given);
            throw new GmsUnavailableException("answer cites diaries it was not given: " + unknown);
        }
        return new Answer(text, cited);
    }

    /**
     * The answer to a picked search, led by the number of diaries the model actually picked.
     * The count is the server's, so the sentence and {@code stats.matchedCount} cannot
     * disagree.
     */
    static String withCount(int pickedDays, String answer) {
        return "관련된 날이 " + pickedDays + "일 있었어요. " + answer;
    }

    static String input(Material material) {
        StringBuilder input = new StringBuilder();
        input.append("[질문] ").append(material.question()).append('\n');
        input.append("[오늘] ").append(material.today()).append(" (").append(weekday(material.today())).append(")\n");
        input.append("[조건] ").append(conditions(material.criteria())).append('\n');

        // With a pick the count is not known until the model has picked, so the model is not
        // shown one it might repeat; withCount puts the real one in front afterwards.
        if (!material.pickRelevant()) {
            input.append("[통계] 맞는 기록 ").append(material.matchedCount()).append("개");
            if (!material.emotionCounts().isEmpty()) {
                input.append(", 감정별: ").append(material.emotionCounts().stream()
                        .map(count -> count.emotion().label() + " " + count.count())
                        .collect(Collectors.joining(", ")));
            }
            input.append('\n');
        }

        if (!material.candidates().isEmpty()) {
            input.append("[찾은 기록] id: 날짜 / 감정 / 아이콘 / 한 줄 일기\n");
            for (Candidate candidate : material.candidates()) {
                input.append("- ").append(candidate.diaryId()).append(": ")
                        .append(candidate.recordDate()).append(" / ")
                        .append(candidate.emotion().label()).append(" / ")
                        .append(candidate.iconNames().isEmpty() ? "-" : String.join(", ", candidate.iconNames()))
                        .append(" / ")
                        .append(candidate.content() == null ? "-" : candidate.content())
                        .append('\n');
            }
        }
        if (material.pickRelevant()) {
            input.append("[고르기] 찾은 기록은 \"").append(material.criteria().keyword())
                    .append("\"과 가까운 순서다. 질문과 관련 있는 기록만 diaryIds에 넣는다.\n");
        }

        WeeklyContext weekly = material.weekly();
        if (!weekly.recordedDays().isEmpty()) {
            input.append("[이번 주] 기록한 감정: ").append(weekly.recordedDays().stream()
                    .map(AnswerWriter::day).collect(Collectors.joining(", ")));
            WeeklyContext.Streak streak = weekly.streak();
            if (streak != null) {
                input.append(" (최근 ").append(streak.days()).append("일 연속 ").append(streak.emotion().label())
                        .append(')');
            }
            input.append('\n');
        }
        if (!weekly.searches().isEmpty()) {
            input.append("[이번 주] 지난 검색에서 찾은 감정: ").append(weekly.searches().stream()
                    .map(search -> monthDay(search.date()) + " " + search.emotions().stream()
                            .map(Emotion::label).collect(Collectors.joining("·")))
                    .collect(Collectors.joining(", "))).append('\n');
        }
        if (weekly.negativeRun()) {
            input.append("[주의] 최근 며칠 우울하거나 화난 감정이 이어졌다.\n");
        }
        return input.toString();
    }

    private static String conditions(SearchCriteria criteria) {
        String period = criteria.from() == null && criteria.to() == null
                ? "전체 기간"
                : (criteria.from() == null ? "처음" : criteria.from().toString()) + " ~ "
                        + (criteria.to() == null ? "오늘" : criteria.to().toString());
        String emotions = criteria.emotions().isEmpty()
                ? "모든 감정"
                : criteria.emotions().stream().map(Emotion::label).collect(Collectors.joining(", "));
        return period + " / " + emotions
                + (criteria.keyword() == null ? "" : " / 키워드 \"" + criteria.keyword() + "\"");
    }

    private static String day(DayEmotion day) {
        return monthDay(day.recordDate()) + "(" + weekday(day.recordDate()).charAt(0) + ") " + day.emotion().label();
    }

    private static String monthDay(LocalDate date) {
        return date.getMonthValue() + "/" + date.getDayOfMonth();
    }

    private static String weekday(LocalDate date) {
        return date.getDayOfWeek().getDisplayName(TextStyle.FULL, Locale.KOREAN);
    }

}
