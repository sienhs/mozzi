package com.ssafy.mozzi.domain.search.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.mozzi.domain.auth.service.MemberSessionService;
import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.icon.entity.IconCategory;
import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.domain.search.service.AnswerWriter;
import com.ssafy.mozzi.domain.search.service.QuestionInterpreter;
import com.ssafy.mozzi.domain.search.service.QuestionInterpreter.Intent;
import com.ssafy.mozzi.integration.gms.GmsEmbeddingClient;
import com.ssafy.mozzi.integration.gms.GmsLlmClient;
import com.ssafy.mozzi.integration.gms.GmsPrompt;
import com.ssafy.mozzi.integration.gms.GmsUnavailableException;
import com.ssafy.mozzi.support.DiaryFixtures;
import com.ssafy.mozzi.support.IntegrationTest;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * API spec emotion-search.md end to end, against the real schema and pgvector. Only GMS is
 * replaced: the interpretation and the answer are scripted per test, and the prompts the
 * model would have seen are captured.
 */
@IntegrationTest
@AutoConfigureMockMvc
class EmotionSearchApiTest {

    private static final int DIMENSIONS = 1536;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private MemberSessionService sessionService;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private Clock clock;

    @MockitoBean
    private GmsLlmClient llmClient;

    @MockitoBean
    private GmsEmbeddingClient embeddingClient;

    private final Map<Long, String> accessTokens = new HashMap<>();

    private DiaryFixtures fixtures;
    private Long baseIcon;
    private final Map<Emotion, Long> emoticons = new HashMap<>();
    private final Map<String, Long> myIcons = new HashMap<>();
    private Long me;
    private Long someoneElse;
    private LocalDate today;

    @BeforeEach
    void setUp() {
        // Cascades to diary, its icons, diary_embedding, emotion_search and emotion_search_result.
        fixtures = new DiaryFixtures(jdbcTemplate);
        fixtures.reset();
        emoticons.clear();
        myIcons.clear();
        baseIcon = fixtures.icon();
        me = newMember("me");
        someoneElse = newMember("someoneElse");
        accessTokens.clear();
        today = LocalDate.now(clock);
        when(embeddingClient.embed(anyString())).thenReturn(axis(0));
    }

    @Test
    void suggestionsAreTheFixedQuestions() throws Exception {
        mockMvc.perform(as(me, get("/api/v1/emotion-search/suggestions")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.suggestions.length()").value(3))
                .andExpect(jsonPath("$.suggestions[0]").value("마음이 편했던 날을 보여 줘"));
    }

    /** S-02: the conditions are the whole question, so every match is in the answer. */
    @Test
    void matchingDiariesAreTheAnswerNewestFirst() throws Exception {
        Diary older = insertDiary(me, today.minusDays(5), Emotion.CALM, "엄마랑 산책", "가족", "휴식");
        Diary newer = insertDiary(me, today.minusDays(2), Emotion.CALM, "낮잠", "휴식");
        insertDiary(me, today.minusDays(1), Emotion.HAPPY, "맛집", "친구");
        insertDiary(someoneElse, today.minusDays(2), Emotion.CALM, "남의 일기", "휴식");
        interpretAs(new QuestionInterpreter.Answer(null, null, List.of(Emotion.CALM), null, Intent.LIST));
        answerWith(new AnswerWriter.Answer("평온 모찌를 고른 날이 2일 있었어요.", List.of()));

        JsonNode body = body(ask(me, "마음이 편했던 날을 보여 줘")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resultType").value("FOUND"))
                .andExpect(jsonPath("$.question").value("마음이 편했던 날을 보여 줘"))
                .andExpect(jsonPath("$.answer").value("평온 모찌를 고른 날이 2일 있었어요."))
                .andExpect(jsonPath("$.interpretedFilter.emotions[0]").value("CALM"))
                .andExpect(jsonPath("$.interpretedFilter.from").isEmpty())
                .andExpect(jsonPath("$.interpretedFilter.keyword").isEmpty())
                .andExpect(jsonPath("$.stats.matchedCount").value(2))
                .andExpect(jsonPath("$.stats.emotionCounts").isEmpty())
                .andExpect(jsonPath("$.featured.diaryId").value(newer.getId()))
                .andExpect(jsonPath("$.featured.content").value("낮잠"))
                .andExpect(jsonPath("$.diaries.length()").value(2))
                .andExpect(jsonPath("$.diaries[0].diaryId").value(newer.getId()))
                .andExpect(jsonPath("$.diaries[1].diaryId").value(older.getId())));

        long searchId = body.get("searchId").asLong();
        assertThat(jdbcTemplate.queryForObject(
                "select result_type from emotion_search where emotion_search_id = ?", String.class, searchId))
                .isEqualTo("FOUND");
        assertThat(jdbcTemplate.queryForObject(
                "select interpreted_filter->'emotions'->>0 from emotion_search where emotion_search_id = ?",
                String.class, searchId)).isEqualTo("CALM");
        assertThat(jdbcTemplate.queryForList(
                "select diary_id from emotion_search_result where emotion_search_id = ? order by rank_no",
                Long.class, searchId)).containsExactly(newer.getId(), older.getId());
        assertThat(jdbcTemplate.queryForObject(
                "select diary_id from emotion_search_result where emotion_search_id = ? and is_featured",
                Long.class, searchId)).isEqualTo(newer.getId());

        String input = answerPrompt().input();
        assertThat(input).contains("엄마랑 산책", "낮잠").doesNotContain("남의 일기", "맛집");
    }

    /**
     * A keyword ranks by meaning: the older diary sits on the query's axis, so it comes first
     * in the prompt, and only the diary the model picks is in the answer.
     */
    @Test
    void keywordRanksByMeaningAndKeepsWhatTheModelPicked() throws Exception {
        Diary praised = insertDiary(me, today.minusDays(6), Emotion.HAPPY, "팀장님께 칭찬받음", "업무");
        Diary other = insertDiary(me, today.minusDays(1), Emotion.HAPPY, "점심 맛있었다", "업무");
        embed(praised, axis(0));
        embed(other, axis(1));
        interpretAs(new QuestionInterpreter.Answer(null, null, List.of(), "칭찬", Intent.LIST));
        answerWith(new AnswerWriter.Answer("칭찬받은 날이 하루 있었어요.", List.of(praised.getId())));

        ask(me, "칭찬받았던 날 있었어?")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resultType").value("FOUND"))
                .andExpect(jsonPath("$.interpretedFilter.keyword").value("칭찬"))
                .andExpect(jsonPath("$.stats.matchedCount").value(1))
                .andExpect(jsonPath("$.diaries.length()").value(1))
                .andExpect(jsonPath("$.diaries[0].diaryId").value(praised.getId()))
                .andExpect(jsonPath("$.featured.diaryId").value(praised.getId()));

        String input = answerPrompt().input();
        assertThat(input.indexOf("팀장님께 칭찬받음")).isLessThan(input.indexOf("점심 맛있었다"));
        assertThat(input).contains("[고르기]");
    }

    /**
     * Every condition at once, so every branch of the shared {@code where} clause is in one
     * statement.
     */
    @Test
    void periodAndEmotionNarrowTogether() throws Exception {
        Diary match = insertDiary(me, today.minusDays(3), Emotion.CALM, "엄마랑 산책", "가족", "휴식");
        insertDiary(me, today.minusDays(4), Emotion.CALM, "혼자 낮잠", "휴식");
        insertDiary(me, today.minusDays(5), Emotion.HAPPY, "가족 외식", "가족");
        insertDiary(me, today.minusDays(20), Emotion.CALM, "예전 가족 나들이", "가족");
        interpretAs(new QuestionInterpreter.Answer(today.minusDays(7).toString(), today.toString(),
                List.of(Emotion.CALM), null, Intent.LIST));
        answerWith(new AnswerWriter.Answer("이번 주에 편안했던 날이 이틀 있었어요.", List.of()));

        ask(me, "이번 주에 편했던 날")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resultType").value("FOUND"))
                .andExpect(jsonPath("$.stats.matchedCount").value(2))
                .andExpect(jsonPath("$.diaries.length()").value(2))
                .andExpect(jsonPath("$.diaries[0].diaryId").value(match.getId()));
    }

    /** Icon names are no filter, but the answer sees them next to each diary. */
    @Test
    void answerSeesEachDiarysIconNames() throws Exception {
        insertDiary(me, today.minusDays(1), Emotion.CALM, "엄마랑 산책", "공원", "엄마");
        interpretAs(new QuestionInterpreter.Answer(null, null, List.of(Emotion.CALM), null, Intent.LIST));
        answerWith(new AnswerWriter.Answer("엄마와 산책한 날이 있었어요.", List.of()));

        ask(me, "편했던 날").andExpect(status().isOk());

        assertThat(answerPrompt().input()).contains("/ 공원, 엄마 / 엄마랑 산책");
    }

    /** The ordering is lost, not the answer: the candidates come newest first instead. */
    @Test
    void failedEmbeddingRanksByDateInstead() throws Exception {
        Diary praised = insertDiary(me, today.minusDays(6), Emotion.HAPPY, "팀장님께 칭찬받음", "업무");
        Diary other = insertDiary(me, today.minusDays(1), Emotion.HAPPY, "점심 맛있었다", "업무");
        embed(praised, axis(0));
        embed(other, axis(1));
        when(embeddingClient.embed(anyString())).thenThrow(new GmsUnavailableException("embeddings answered 500"));
        interpretAs(new QuestionInterpreter.Answer(null, null, List.of(), "칭찬", Intent.LIST));
        answerWith(new AnswerWriter.Answer("칭찬받은 날이 하루 있었어요.", List.of(praised.getId())));

        ask(me, "칭찬받았던 날 있었어?")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resultType").value("FOUND"))
                .andExpect(jsonPath("$.diaries[0].diaryId").value(praised.getId()));

        String input = answerPrompt().input();
        assertThat(input.indexOf("점심 맛있었다")).isLessThan(input.indexOf("팀장님께 칭찬받음"));
    }

    /** The model judged none of the candidates to be about the question (E-04). */
    @Test
    void keywordWithNothingRelevantIsEmpty() throws Exception {
        insertDiary(me, today.minusDays(1), Emotion.HAPPY, "점심 맛있었다", "업무");
        interpretAs(new QuestionInterpreter.Answer(null, null, List.of(), "칭찬", Intent.LIST));
        answerWith(new AnswerWriter.Answer("칭찬받은 기록은 찾지 못했어요.", List.of()));

        ask(me, "칭찬받았던 날 있었어?")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resultType").value("EMPTY"))
                .andExpect(jsonPath("$.answer").isEmpty())
                .andExpect(jsonPath("$.diaries.length()").value(0));
    }

    /** E-04: nothing to write about, so the answer model is not asked. */
    @Test
    void noMatchIsEmptyWithoutAnAnswer() throws Exception {
        insertDiary(me, today.minusDays(1), Emotion.HAPPY, "맛집", "친구");
        interpretAs(new QuestionInterpreter.Answer(null, null, List.of(Emotion.SAD), null, Intent.LIST));

        JsonNode body = body(ask(me, "슬펐던 날 보여 줘")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resultType").value("EMPTY"))
                .andExpect(jsonPath("$.answer").isEmpty())
                .andExpect(jsonPath("$.featured").isEmpty())
                .andExpect(jsonPath("$.diaries.length()").value(0))
                .andExpect(jsonPath("$.stats.matchedCount").value(0)));

        verify(llmClient, never()).respond(any(), eq(AnswerWriter.Answer.class));
        assertThat(jdbcTemplate.queryForObject(
                "select result_type from emotion_search where emotion_search_id = ?", String.class,
                body.get("searchId").asLong())).isEqualTo("EMPTY");
    }

    @Test
    void countQuestionIsAnsweredByStats() throws Exception {
        insertDiary(me, today.minusDays(3), Emotion.CALM, null, "휴식");
        insertDiary(me, today.minusDays(2), Emotion.CALM, null, "휴식");
        insertDiary(me, today.minusDays(1), Emotion.SAD, null, "업무");
        interpretAs(new QuestionInterpreter.Answer(
                today.withDayOfMonth(1).minusMonths(1).toString(), today.toString(), List.of(), null,
                Intent.STATS));
        answerWith(new AnswerWriter.Answer("평온한 날이 가장 많았어요.", List.of()));

        ask(me, "요즘 어떤 기분이 많았어?")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resultType").value("STATS_ONLY"))
                .andExpect(jsonPath("$.stats.matchedCount").value(3))
                .andExpect(jsonPath("$.stats.emotionCounts[0].emotion").value("CALM"))
                .andExpect(jsonPath("$.stats.emotionCounts[0].count").value(2))
                .andExpect(jsonPath("$.stats.emotionCounts[1].emotion").value("SAD"))
                .andExpect(jsonPath("$.featured").isEmpty())
                .andExpect(jsonPath("$.diaries.length()").value(0));

        assertThat(answerPrompt().input()).contains("평온 2", "우울 1");
    }

    /**
     * "칭찬받은 날은 몇 번이야?": SQL cannot tell which diaries are about praise, so the count
     * follows the model's pick instead of every diary in the period.
     */
    @Test
    void countOverAKeywordCountsOnlyThePickedDiaries() throws Exception {
        Diary praised = insertDiary(me, today.minusDays(2), Emotion.HAPPY, "칭찬받음", "업무");
        insertDiary(me, today.minusDays(1), Emotion.SAD, "비가 옴", "휴식");
        interpretAs(new QuestionInterpreter.Answer(null, null, List.of(), "칭찬", Intent.STATS));
        // The model says "2" although it picked one; the sentence the member reads must not.
        answerWith(new AnswerWriter.Answer("두 번 모두 회사에서 칭찬받은 날이에요.", List.of(praised.getId())));

        ask(me, "칭찬받은 날은 몇 번이야?")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resultType").value("STATS_ONLY"))
                .andExpect(jsonPath("$.answer").value(startsWith("관련된 날이 1일 있었어요. ")))
                .andExpect(jsonPath("$.stats.matchedCount").value(1))
                .andExpect(jsonPath("$.stats.emotionCounts.length()").value(1))
                .andExpect(jsonPath("$.stats.emotionCounts[0].emotion").value("HAPPY"))
                .andExpect(jsonPath("$.featured").isEmpty())
                .andExpect(jsonPath("$.diaries.length()").value(0));

        // No pre-pick count for the model to repeat.
        assertThat(answerPrompt().input()).contains("칭찬받음", "비가 옴", "[고르기]").doesNotContain("[통계]");
    }

    /**
     * An answer that breaks the schema despite strict mode (a null list) is E-05 and is
     * stored, not a 500 from a NullPointerException.
     */
    @Test
    void interpretationBreakingTheSchemaIsServiceUnavailable() throws Exception {
        interpretAs(new QuestionInterpreter.Answer(null, null, null, null, Intent.LIST));

        ask(me, "마음이 편했던 날을 보여 줘")
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SEARCH_UNAVAILABLE"));
        assertThat(jdbcTemplate.queryForObject(
                "select result_type from emotion_search where member_id = ?", String.class, me)).isEqualTo("FAILED");
    }

    @Test
    void answerBreakingTheSchemaIsServiceUnavailable() throws Exception {
        insertDiary(me, today.minusDays(1), Emotion.CALM, "낮잠", "휴식");
        interpretAs(new QuestionInterpreter.Answer(null, null, List.of(Emotion.CALM), null, Intent.LIST));
        answerWith(new AnswerWriter.Answer("평온한 날이 하루 있었어요.", null));

        ask(me, "마음이 편했던 날을 보여 줘")
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SEARCH_UNAVAILABLE"));
    }

    /** Spec: the answer must not be made up, so one that cites a diary it was not given fails. */
    @Test
    void answerCitingADiaryItWasNotGivenFails() throws Exception {
        Diary mine = insertDiary(me, today.minusDays(1), Emotion.HAPPY, "칭찬받음", "업무");
        Diary theirs = insertDiary(someoneElse, today.minusDays(1), Emotion.HAPPY, "남의 일기", "업무");
        interpretAs(new QuestionInterpreter.Answer(null, null, List.of(), "칭찬", Intent.LIST));
        answerWith(new AnswerWriter.Answer("두 번 있었어요.", List.of(mine.getId(), theirs.getId())));

        ask(me, "칭찬받았던 날 있었어?")
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SEARCH_UNAVAILABLE"))
                .andExpect(jsonPath("$.message").value("지금은 답을 찾지 못했어요."));

        assertThat(jdbcTemplate.queryForMap("select result_type, answer, interpreted_filter is not null as has_filter "
                + "from emotion_search where member_id = ?", me))
                .containsEntry("result_type", "FAILED")
                .containsEntry("answer", null)
                .containsEntry("has_filter", true);
        assertThat(jdbcTemplate.queryForObject("select count(*) from emotion_search_result", Long.class)).isZero();
    }

    /** E-05, and the failure still counts towards the per-minute limit. */
    @Test
    void gmsOutageIsServiceUnavailableAndStored() throws Exception {
        when(llmClient.respond(any(), eq(QuestionInterpreter.Answer.class)))
                .thenThrow(new GmsUnavailableException("responses answered 502"));

        ask(me, "마음이 편했던 날을 보여 줘")
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SEARCH_UNAVAILABLE"));

        assertThat(jdbcTemplate.queryForMap(
                "select result_type, interpreted_filter, latency_ms from emotion_search where member_id = ?", me))
                .containsEntry("result_type", "FAILED")
                .containsEntry("interpreted_filter", null)
                .containsKey("latency_ms");
    }

    @Test
    void eleventhQuestionInAMinuteIsRateLimited() throws Exception {
        for (int i = 0; i < 10; i++) {
            jdbcTemplate.update("insert into emotion_search (member_id, question, result_type, created_at) "
                    + "values (?, 'q', 'FAILED', now() - interval '30 seconds')", me);
        }
        // Outside the minute, so it does not count.
        jdbcTemplate.update("insert into emotion_search (member_id, question, result_type, created_at) "
                + "values (?, 'q', 'FAILED', now() - interval '2 minutes')", me);

        ask(me, "마음이 편했던 날을 보여 줘")
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RATE_LIMITED"));
        verify(llmClient, never()).respond(any(), any());

        interpretAs(new QuestionInterpreter.Answer(null, null, List.of(Emotion.SAD), null, Intent.LIST));
        ask(someoneElse, "슬펐던 날 보여 줘").andExpect(status().isOk());
    }

    @Test
    void blankOrOverlongQuestionIsInvalid() throws Exception {
        ask(me, "   ").andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        ask(me, "가".repeat(201))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        verify(llmClient, never()).respond(any(), any());
    }

    /**
     * Step ③: the answer is told about the week, as facts the server worked out, and is
     * warned off comparisons after two low days.
     */
    @Test
    void answerSeesTheWeekAndIsWarnedAfterLowDays() throws Exception {
        insertDiary(me, today.minusDays(1), Emotion.SAD, "피곤", "업무");
        insertDiary(me, today, Emotion.SAD, "비 옴", "휴식");
        // Last week's diary is outside the seven days.
        insertDiary(me, today.minusDays(8), Emotion.HAPPY, "여행", "취미");
        jdbcTemplate.update("insert into emotion_search (member_id, question, interpreted_filter, result_type, created_at) "
                + "values (?, 'q', '{\"from\":null,\"to\":null,\"emotions\":[\"HAPPY\"],\"keyword\":null}'::jsonb, "
                + "'FOUND', now() - interval '1 hour')", me);
        interpretAs(new QuestionInterpreter.Answer(null, null, List.of(Emotion.SAD), null, Intent.LIST));
        answerWith(new AnswerWriter.Answer("우울을 고른 날이 2일 있었어요.", List.of()));

        ask(me, "슬펐던 날 보여 줘").andExpect(status().isOk());

        String input = answerPrompt().input();
        assertThat(input)
                .contains("2일 연속 우울")
                .contains("지난 검색에서 찾은 감정: " + today.getMonthValue() + "/" + today.getDayOfMonth() + " 행복")
                .contains("[주의]")
                .doesNotContain("여행");
    }

    private void interpretAs(QuestionInterpreter.Answer answer) {
        when(llmClient.respond(any(), eq(QuestionInterpreter.Answer.class))).thenReturn(answer);
    }

    private void answerWith(AnswerWriter.Answer answer) {
        when(llmClient.respond(any(), eq(AnswerWriter.Answer.class))).thenReturn(answer);
    }

    private GmsPrompt answerPrompt() {
        ArgumentCaptor<GmsPrompt> prompt = ArgumentCaptor.forClass(GmsPrompt.class);
        verify(llmClient).respond(prompt.capture(), eq(AnswerWriter.Answer.class));
        return prompt.getValue();
    }

    private ResultActions ask(Long memberId, String question) throws Exception {
        return mockMvc.perform(as(memberId, post("/api/v1/emotion-search"))
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("question", question))));
    }

    private MockHttpServletRequestBuilder as(Long memberId, MockHttpServletRequestBuilder request) {
        String token = accessTokens.computeIfAbsent(memberId,
                id -> transactionTemplate.execute(status -> sessionService.start(id)).accessToken());
        return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
    }

    private JsonNode body(ResultActions result) throws Exception {
        return objectMapper.readTree(result.andReturn().getResponse().getContentAsString());
    }

    /**
     * A diary with the given content and icons. Icons are made on first use per member and
     * name, as {@code WHAT} icons: emotion search reads only their names.
     */
    private Diary insertDiary(Long memberId, LocalDate recordDate, Emotion emotion, String content,
            String... iconNames) {
        Long emoticonId = emoticons.computeIfAbsent(emotion, fixtures::emoticon);
        Long diaryId = fixtures.diary(memberId, recordDate, emoticonId, emotion, content);
        for (String name : iconNames) {
            Long myIconId = myIcons.computeIfAbsent(memberId + "/" + name,
                    key -> fixtures.myIcon(memberId, baseIcon, name, IconCategory.WHAT));
            fixtures.attach(diaryId, myIconId);
        }
        return new Diary(diaryId);
    }

    /** Just the id, which is all these tests read from a diary. */
    private record Diary(Long getId) {
    }

    private void embed(Diary diary, float[] vector) {
        jdbcTemplate.update("insert into diary_embedding (diary_id, model, content_hash, embedding, created_at, updated_at) "
                + "values (?, 'text-embedding-3-large@1536', 'hash', cast(? as vector), now(), now())",
                diary.getId(), literal(vector));
    }

    /** A unit vector along one axis; two different axes are as far apart as vectors get. */
    private static float[] axis(int index) {
        float[] vector = new float[DIMENSIONS];
        vector[index] = 1f;
        return vector;
    }

    private static String literal(float[] vector) {
        StringBuilder literal = new StringBuilder("[");
        for (int i = 0; i < vector.length; i++) {
            literal.append(i == 0 ? "" : ",").append(vector[i]);
        }
        return literal.append(']').toString();
    }

    private Long newMember(String subject) {
        return memberRepository.saveAndFlush(
                Member.signUp(subject + "@gmail.com", AuthProvider.GOOGLE, subject, subject)).getId();
    }

}
