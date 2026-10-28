package com.ssafy.mozzi.domain.search.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.context.bean.override.mockito.MockitoSpyBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.mozzi.domain.auth.service.MemberSessionService;
import com.ssafy.mozzi.domain.diary.entity.ActivityCode;
import com.ssafy.mozzi.domain.diary.entity.Diary;
import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.diary.repository.ActivityRepository;
import com.ssafy.mozzi.domain.diary.repository.DiaryRepository;
import com.ssafy.mozzi.domain.diary.service.DiaryService;
import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.domain.search.service.AnswerWriter;
import com.ssafy.mozzi.domain.search.service.QuestionInterpreter;
import com.ssafy.mozzi.domain.search.service.QuestionInterpreter.Intent;
import com.ssafy.mozzi.domain.search.service.WeeklyContextReader;
import com.ssafy.mozzi.integration.gms.GmsEmbeddingClient;
import com.ssafy.mozzi.integration.gms.GmsLlmClient;
import com.ssafy.mozzi.support.IntegrationTest;

import tools.jackson.databind.ObjectMapper;

/**
 * The spec's 10-second limit, shrunk to two seconds so slow GMS calls can be staged without
 * slowing the build. A class of its own: the other API tests keep the real budget, so a
 * slow CI machine cannot push them over it.
 */
@IntegrationTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "mozzi.search.time-budget=2s")
class EmotionSearchTimeBudgetTest {

    private static final long SLOW_MILLIS = 2_500;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private DiaryRepository diaryRepository;

    @Autowired
    private ActivityRepository activityRepository;

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

    @MockitoSpyBean
    private WeeklyContextReader weeklyContextReader;

    @MockitoSpyBean
    private DiaryService diaryService;

    private Long me;
    private String token;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("truncate table member cascade");
        me = memberRepository.saveAndFlush(Member.signUp("me@gmail.com", AuthProvider.GOOGLE, "me", "me")).getId();
        token = transactionTemplate.execute(status -> sessionService.start(me)).accessToken();
        diaryRepository.saveAndFlush(Diary.create(me, LocalDate.now(clock).minusDays(1), Emotion.HAPPY, "칭찬받음",
                activityRepository.findByCodeInAndActiveTrue(List.of(ActivityCode.WORK))));
    }

    /** The interpretation alone used the budget up, so the answer is not even asked for. */
    @Test
    void questionPastTheBudgetIsServiceUnavailable() throws Exception {
        when(llmClient.respond(any(), eq(QuestionInterpreter.Answer.class))).thenAnswer(invocation -> {
            Thread.sleep(SLOW_MILLIS);
            return new QuestionInterpreter.Answer(null, null, List.of(Emotion.HAPPY), List.of(), null, Intent.LIST);
        });

        ask("행복했던 날").andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("SEARCH_UNAVAILABLE"));

        verify(llmClient, never()).respond(any(), eq(AnswerWriter.Answer.class));
        assertThat(jdbcTemplate.queryForObject(
                "select result_type from emotion_search where member_id = ?", String.class, me)).isEqualTo("FAILED");
    }

    /**
     * A slow embedding is not waited for: the answer call needs the rest of the budget, so
     * the candidates are ranked by date and the question still gets its answer in time.
     */
    @Test
    void slowEmbeddingIsNotWaitedFor() throws Exception {
        when(embeddingClient.embed(anyString())).thenAnswer(invocation -> {
            Thread.sleep(SLOW_MILLIS);
            return new float[1536];
        });
        when(llmClient.respond(any(), eq(QuestionInterpreter.Answer.class)))
                .thenReturn(new QuestionInterpreter.Answer(null, null, List.of(), List.of(), "칭찬", Intent.LIST));
        Long diaryId = jdbcTemplate.queryForObject("select diary_id from diary where member_id = ?", Long.class, me);
        when(llmClient.respond(any(), eq(AnswerWriter.Answer.class)))
                .thenReturn(new AnswerWriter.Answer("칭찬받은 날이 하루 있었어요.", List.of(diaryId)));

        long started = System.nanoTime();
        ask("칭찬받았던 날 있었어?").andExpect(status().isOk())
                .andExpect(jsonPath("$.resultType").value("FOUND"));

        assertThat((System.nanoTime() - started) / 1_000_000).isLessThan(SLOW_MILLIS);
    }

    /** The budget is checked after the diaries are read, not before: no answer call starts late. */
    @Test
    void slowReadBeforeTheAnswerIsServiceUnavailable() throws Exception {
        when(llmClient.respond(any(), eq(QuestionInterpreter.Answer.class)))
                .thenReturn(new QuestionInterpreter.Answer(null, null, List.of(Emotion.HAPPY), List.of(), null,
                        Intent.LIST));
        doAnswer(invocation -> {
            Thread.sleep(SLOW_MILLIS);
            return invocation.callRealMethod();
        }).when(weeklyContextReader).read(any(), any());

        ask("행복했던 날").andExpect(status().isServiceUnavailable());

        verify(llmClient, never()).respond(any(), eq(AnswerWriter.Answer.class));
    }

    /** An answer that is ready but late is thrown out, not stored as a success. */
    @Test
    void slowRenderingIsServiceUnavailable() throws Exception {
        when(llmClient.respond(any(), eq(QuestionInterpreter.Answer.class)))
                .thenReturn(new QuestionInterpreter.Answer(null, null, List.of(Emotion.HAPPY), List.of(), null,
                        Intent.LIST));
        when(llmClient.respond(any(), eq(AnswerWriter.Answer.class)))
                .thenReturn(new AnswerWriter.Answer("행복한 날이 하루 있었어요.", List.of()));
        doAnswer(invocation -> {
            Thread.sleep(SLOW_MILLIS);
            return invocation.callRealMethod();
        }).when(diaryService).summaries(any(), any());

        ask("행복했던 날").andExpect(status().isServiceUnavailable());

        assertThat(jdbcTemplate.queryForList("select result_type from emotion_search where member_id = ?",
                String.class, me)).containsExactly("FAILED");
        assertThat(jdbcTemplate.queryForObject("select count(*) from emotion_search_result", Long.class)).isZero();
    }

    private ResultActions ask(String question) throws Exception {
        return mockMvc.perform(post("/api/v1/emotion-search")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(Map.of("question", question))));
    }

}
