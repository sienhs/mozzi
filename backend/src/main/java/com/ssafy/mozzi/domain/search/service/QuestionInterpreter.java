package com.ssafy.mozzi.domain.search.service;

import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.time.format.TextStyle;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import com.ssafy.mozzi.domain.diary.entity.ActivityCode;
import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.search.repository.SearchCriteria;
import com.ssafy.mozzi.integration.gms.GmsLlmClient;
import com.ssafy.mozzi.integration.gms.GmsPrompt;
import com.ssafy.mozzi.integration.gms.GmsUnavailableException;

/**
 * Step ① of emotion search: the question becomes conditions (spec emotion-search.md).
 *
 * <p>The model only reads the question; it never sees a diary here. Emotion and activity
 * codes are {@code enum}s in the schema, so the answer can only name codes that exist.
 */
@Component
public class QuestionInterpreter {

    /** Longer than any phrase the prompt asks for; cuts off a model that writes a sentence. */
    static final int KEYWORD_MAX_LENGTH = 50;

    public enum Intent {
        /** Find diaries. */
        LIST,
        /** Count emotions ("어떤 기분이 많았어?"); answered by {@code STATS_ONLY}. */
        STATS
    }

    public record Interpretation(SearchCriteria criteria, Intent intent) {
    }

    /** The model's answer, bound from {@link #SCHEMA}. Dates are strings until checked. */
    public record Answer(String from, String to, List<Emotion> emotions, List<ActivityCode> activities,
            String keyword, Intent intent) {
    }

    private static final Map<String, Object> NULLABLE_STRING = Map.of("type", List.of("string", "null"));

    static final Map<String, Object> SCHEMA = Map.of(
            "type", "object",
            "additionalProperties", false,
            "required", List.of("from", "to", "emotions", "activities", "keyword", "intent"),
            "properties", Map.of(
                    "from", NULLABLE_STRING,
                    "to", NULLABLE_STRING,
                    "emotions", Map.of("type", "array", "items", Map.of("type", "string", "enum", names(Emotion.values()))),
                    "activities", Map.of("type", "array",
                            "items", Map.of("type", "string", "enum", names(ActivityCode.values()))),
                    "keyword", NULLABLE_STRING,
                    "intent", Map.of("type", "string", "enum", names(Intent.values()))));

    private final GmsLlmClient llmClient;

    public QuestionInterpreter(GmsLlmClient llmClient) {
        this.llmClient = llmClient;
    }

    /**
     * @param activityLabels the chip labels the member sees, so "가족" maps to the right code
     * @throws GmsUnavailableException no usable answer, including a date that is not a date
     */
    public Interpretation interpret(String question, LocalDate today, Map<ActivityCode, String> activityLabels) {
        Answer answer = llmClient.respond(
                new GmsPrompt(instructions(today, activityLabels), question, "search_filter", SCHEMA), Answer.class);
        requireShape(answer);
        return new Interpretation(normalize(answer, today), answer.intent());
    }

    /**
     * Strict mode should make these impossible, but an answer that breaks the schema anyway
     * would otherwise fail later as a {@code NullPointerException}: a 500 instead of E-05,
     * and no {@code FAILED} row for the per-minute limit.
     */
    static void requireShape(Answer answer) {
        // anyMatch rather than contains(null), which List.of lists reject with an NPE.
        if (answer.intent() == null
                || answer.emotions() == null || answer.emotions().stream().anyMatch(Objects::isNull)
                || answer.activities() == null || answer.activities().stream().anyMatch(Objects::isNull)) {
            throw new GmsUnavailableException("interpretation breaks the schema");
        }
    }

    /**
     * Repairs what the schema cannot rule out: a reversed range, an end date in the future
     * (no diary can be there yet), a blank or rambling keyword.
     */
    static SearchCriteria normalize(Answer answer, LocalDate today) {
        LocalDate from = parse(answer.from());
        LocalDate to = parse(answer.to());
        if (from != null && to != null && from.isAfter(to)) {
            LocalDate swap = from;
            from = to;
            to = swap;
        }
        if (to != null && to.isAfter(today)) {
            to = today;
        }
        String keyword = answer.keyword() == null ? null : answer.keyword().strip();
        if (keyword != null && keyword.isEmpty()) {
            keyword = null;
        }
        if (keyword != null && keyword.length() > KEYWORD_MAX_LENGTH) {
            keyword = keyword.substring(0, KEYWORD_MAX_LENGTH);
        }
        return new SearchCriteria(from, to, answer.emotions().stream().distinct().toList(),
                answer.activities().stream().distinct().toList(), keyword);
    }

    private static LocalDate parse(String date) {
        if (date == null || date.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(date.strip());
        } catch (DateTimeParseException e) {
            throw new GmsUnavailableException("interpreted date is not ISO-8601");
        }
    }

    private static String instructions(LocalDate today, Map<ActivityCode, String> activityLabels) {
        String emotions = Arrays.stream(Emotion.values())
                .map(emotion -> emotion.name() + "(" + emotion.label() + ")")
                .collect(Collectors.joining(", "));
        String activities = Arrays.stream(ActivityCode.values())
                .map(code -> code.name() + "(" + activityLabels.getOrDefault(code, code.name()) + ")")
                .collect(Collectors.joining(", "));
        return """
                너는 일기 앱의 검색 조건 해석기다. 사용자의 질문을 검색 조건으로 바꾼다.
                오늘은 %s (%s)이다. 날짜는 YYYY-MM-DD로 쓴다.

                - from, to: 질문이 기간을 말할 때만 채운다. 한 주는 월요일부터 일요일까지다.
                  "이번 주"는 이번 주 월요일부터 오늘까지, "지난주"는 지난주 월요일부터 일요일까지,
                  "이번 달"은 이달 1일부터 오늘까지, "요즘"·"최근"은 오늘을 포함한 최근 7일이다.
                  기간을 말하지 않았으면 둘 다 null이다.
                - emotions: 질문이 가리키는 감정. %s.
                  편했던·차분했던 날은 CALM, 기뻤던·좋았던 날은 HAPPY, 슬펐던·힘들었던 날은 SAD,
                  짜증 났던 날은 ANGRY다. 감정을 말하지 않았으면 []이다.
                - activities: 질문이 가리키는 활동. %s. 말하지 않았으면 []이다.
                - keyword: 기간·감정·활동으로 나타낼 수 없는 내용만 짧은 명사로 쓴다("칭찬", "바다", "생일").
                  감정·활동·기간을 뜻하는 말은 넣지 않는다. 없으면 null이다.
                - intent: 감정이 몇 번이었는지, 어떤 기분이 많았는지처럼 횟수나 분포를 묻는 질문이면 STATS,
                  기록을 찾아 달라는 질문이면 LIST다.
                """.formatted(today, today.getDayOfWeek().getDisplayName(TextStyle.FULL, Locale.KOREAN),
                emotions, activities);
    }

    private static List<String> names(Enum<?>[] values) {
        return Arrays.stream(values).map(Enum::name).toList();
    }

}
