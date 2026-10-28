package com.ssafy.mozzi.domain.image.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.request;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.mozzi.domain.auth.service.MemberSessionService;
import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.image.entity.ImageStatus;
import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.support.DiaryFixtures;
import com.ssafy.mozzi.support.IntegrationTest;

/**
 * Results and the SSE push, against the real schema.
 */
@IntegrationTest
@AutoConfigureMockMvc
class DiaryImageResultServiceTest {

    @Autowired
    private DiaryImageResultService resultService;

    @Autowired
    private MockMvc mockMvc;

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

    private DiaryFixtures fixtures;
    private Long me;
    private Long diaryId;

    @BeforeEach
    void setUp() {
        fixtures = new DiaryFixtures(jdbcTemplate);
        fixtures.reset();
        me = memberRepository.saveAndFlush(Member.signUp("me@gmail.com", AuthProvider.GOOGLE, "me", "me")).getId();
        diaryId = fixtures.diary(me, LocalDate.now(clock), fixtures.emoticon(Emotion.CALM), Emotion.CALM);
        fixtures.picture(diaryId, ImageStatus.PENDING, 0, null);
    }

    @Test
    void aSuccessStoresTheUrlOnBothRows() {
        resultService.succeed(diaryId, "https://cdn.test/diary/done.webp");

        assertThat(picture()).containsEntry("status", "SUCCEEDED").containsEntry("image_url", "https://cdn.test/diary/done.webp");
        assertThat(diaryStatus()).isEqualTo("SUCCEEDED");
    }

    /** SQS may deliver the same failure twice; it counts once. */
    @Test
    void anAiFailureCountsOnce() {
        resultService.fail(diaryId);
        resultService.fail(diaryId);

        assertThat(picture()).containsEntry("status", "FAILED").containsEntry("failure_count", 1);
        assertThat(diaryStatus()).isEqualTo("FAILED");
    }

    @Test
    void aDuplicateSuccessChangesNothing() {
        resultService.succeed(diaryId, "https://cdn.test/diary/done.webp");
        resultService.succeed(diaryId, "https://cdn.test/diary/again.webp");

        assertThat(picture()).containsEntry("image_url", "https://cdn.test/diary/done.webp");
    }

    @Test
    void aResultForAnUnknownDiaryIsIgnored() {
        resultService.succeed(999_999L, "https://cdn.test/diary/x.webp");

        assertThat(picture()).containsEntry("status", "PENDING");
    }

    /** A request that never reached the AI server fails without using up a try. */
    @Test
    void anAbandonedRequestIsNotCounted() {
        resultService.abandon(diaryId);

        assertThat(picture()).containsEntry("status", "FAILED").containsEntry("failure_count", 0);
        assertThat(diaryStatus()).isEqualTo("FAILED");
    }

    /**
     * When the executor is full, abandon runs in the after-commit callback of the member's
     * request. Joining that committed transaction would silently write nothing.
     */
    @Test
    void abandoningFromAnAfterCommitCallbackIsWritten() {
        transactionTemplate.executeWithoutResult(status -> TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        resultService.abandon(diaryId);
                    }
                }));

        assertThat(picture()).containsEntry("status", "FAILED");
    }

    @Test
    void theResultIsPushedToTheSubscriberAndTheStreamCloses() throws Exception {
        MvcResult stream = mockMvc.perform(get("/api/v1/diaries/{id}/image/events", diaryId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token(me))
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(request().asyncStarted())
                .andReturn();

        resultService.succeed(diaryId, "https://cdn.test/diary/done.webp");

        String events = stream.getResponse().getContentAsString();
        assertThat(events)
                .contains("event:connected")
                .contains("event:image")
                .contains("\"status\":\"SUCCEEDED\"")
                .contains("https://cdn.test/diary/done.webp");
        assertThat(stream.getResponse().getHeader("X-Accel-Buffering")).isEqualTo("no");
    }

    @Test
    void onlyTheOwnerCanSubscribe() throws Exception {
        Long someoneElse = memberRepository.saveAndFlush(
                Member.signUp("other@gmail.com", AuthProvider.GOOGLE, "other", "other")).getId();

        mockMvc.perform(get("/api/v1/diaries/{id}/image/events", diaryId)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + token(someoneElse))
                        .accept(MediaType.TEXT_EVENT_STREAM))
                .andExpect(status().isNotFound());
    }

    private Map<String, Object> picture() {
        return jdbcTemplate.queryForMap("select * from diary_image where diary_id = ?", diaryId);
    }

    private String diaryStatus() {
        return jdbcTemplate.queryForObject(
                "select diary_image_status from diary where diary_id = ?", String.class, diaryId);
    }

    private String token(Long memberId) {
        return transactionTemplate.execute(status -> sessionService.start(memberId)).accessToken();
    }

}
