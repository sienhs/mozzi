package com.ssafy.mozzi.domain.image.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.mozzi.domain.auth.service.MemberSessionService;
import com.ssafy.mozzi.domain.diary.controller.DiaryController;
import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.icon.entity.IconCategory;
import com.ssafy.mozzi.domain.image.entity.ImageStatus;
import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.support.DiaryFixtures;
import com.ssafy.mozzi.support.IntegrationTest;

/**
 * {@code POST /diaries/{diaryId}/image} end to end.
 */
@IntegrationTest
@AutoConfigureMockMvc
class DiaryImageApiTest {

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

    private final Map<Long, String> accessTokens = new HashMap<>();

    private DiaryFixtures fixtures;
    private Long me;
    private Long someoneElse;
    private LocalDate today;
    private Long diaryId;
    private Long home;
    private Long mom;
    private Long cooking;
    private Long reading;

    @BeforeEach
    void setUp() {
        fixtures = new DiaryFixtures(jdbcTemplate);
        fixtures.reset();
        me = newMember("me");
        someoneElse = newMember("someoneElse");
        accessTokens.clear();
        today = LocalDate.now(clock);
        Long icon = fixtures.icon();
        home = fixtures.myIcon(me, icon, "우리집", IconCategory.WHERE);
        mom = fixtures.myIcon(me, icon, "엄마", IconCategory.WHO);
        cooking = fixtures.myIcon(me, icon, "요리", IconCategory.WHAT);
        reading = fixtures.myIcon(me, icon, "독서", IconCategory.WHAT);
        diaryId = fixtures.diary(me, today, fixtures.emoticon(Emotion.CALM), Emotion.CALM);
        fixtures.attach(diaryId, home);
        fixtures.attach(diaryId, mom);
        fixtures.attach(diaryId, cooking);
        fixtures.attach(diaryId, reading);
    }

    @Test
    void requestingStoresWhatWasPickedAndStartsThePicture() throws Exception {
        request(me, diaryId, body(7, "\"EVENING\"", home, mom, cooking))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.diaryId").value(diaryId))
                .andExpect(jsonPath("$.imageStatus").value("PENDING"));

        Map<String, Object> row = jdbcTemplate.queryForMap("select * from diary_image where diary_id = ?", diaryId);
        assertThat(row)
                .containsEntry("status", "PENDING")
                .containsEntry("failure_count", 0)
                .containsEntry("character_id", 7L)
                .containsEntry("time_of_day", "EVENING")
                .containsEntry("where_name", "우리집")
                .containsEntry("who_name", "엄마")
                .containsEntry("what_name", "요리");
        mockMvc.perform(as(me, get("/api/v1/diaries/daily").param("date", today.toString())))
                .andExpect(jsonPath("$.image.status").value("PENDING"))
                .andExpect(jsonPath("$.image.imageUrl").isEmpty());
    }

    @Test
    void onlyCharacterAndWhatAreRequired() throws Exception {
        request(me, diaryId, body(7, "null", null, null, cooking))
                .andExpect(status().isAccepted());

        request(me, diaryId, """
                {"timeOfDay": "MORNING", "whatMyIconId": %d}
                """.formatted(cooking))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("characterId"));
    }

    @Test
    void whatIsRequired() throws Exception {
        request(me, diaryId, body(7, "null", home, null, null))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("whatMyIconId"));
    }

    @Test
    void iconsMustBeTheDiarysOwnInTheirCategory() throws Exception {
        Long notOnDiary = fixtures.myIcon(me, fixtures.icon(), "운동", IconCategory.WHAT);

        request(me, diaryId, body(7, "null", null, null, notOnDiary))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        // A WHAT icon sent as WHERE.
        request(me, diaryId, body(7, "null", reading, null, cooking))
                .andExpect(status().isBadRequest());
        assertThat(jdbcTemplate.queryForObject("select count(*) from diary_image", Integer.class)).isZero();
    }

    @Test
    void aSecondRequestWhileDrawingIsRejected() throws Exception {
        request(me, diaryId, body(7, "null", null, null, cooking)).andExpect(status().isAccepted());

        request(me, diaryId, body(7, "null", null, null, reading))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IMAGE_ALREADY_REQUESTED"));
    }

    @Test
    void aFinishedPictureIsNotRedrawn() throws Exception {
        fixtures.picture(diaryId, ImageStatus.SUCCEEDED, 0, "https://cdn.test/diary/done.webp");

        request(me, diaryId, body(7, "null", null, null, cooking))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IMAGE_ALREADY_REQUESTED"));
    }

    @Test
    void aFailedPictureCanBeRequestedAgainWithNewPicks() throws Exception {
        fixtures.picture(diaryId, ImageStatus.FAILED, 2, null);

        request(me, diaryId, body(9, "\"LUNCH\"", null, null, reading))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.imageStatus").value("PENDING"));

        Map<String, Object> row = jdbcTemplate.queryForMap("select * from diary_image where diary_id = ?", diaryId);
        assertThat(row)
                .containsEntry("status", "PENDING")
                .containsEntry("failure_count", 2)
                .containsEntry("character_id", 9L)
                .containsEntry("time_of_day", "LUNCH")
                .containsEntry("what_name", "독서");
        assertThat(jdbcTemplate.queryForObject(
                "select diary_image_status from diary where diary_id = ?", String.class, diaryId))
                .isEqualTo("PENDING");
    }

    /** Pictures are made on the diary's own day only, retries included. */
    @Test
    void aPastDiaryCannotGetAPicture() throws Exception {
        Long yesterday = fixtures.diary(me, today.minusDays(1), fixtures.emoticon(Emotion.SAD), Emotion.SAD);
        fixtures.attach(yesterday, cooking);

        request(me, yesterday, body(7, "null", null, null, cooking))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("IMAGE_ONLY_TODAY"));

        fixtures.picture(yesterday, ImageStatus.FAILED, 1, null);
        request(me, yesterday, body(7, "null", null, null, cooking))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("IMAGE_ONLY_TODAY"));
    }

    @Test
    void threeFailuresAreTheLimit() throws Exception {
        fixtures.picture(diaryId, ImageStatus.FAILED, 3, null);

        request(me, diaryId, body(7, "null", null, null, cooking))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RETRY_LIMIT_EXCEEDED"));
    }

    @Test
    void anotherMembersDiaryIsNotFound() throws Exception {
        request(someoneElse, diaryId, body(7, "null", null, null, cooking))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void idempotencyKeyIsRequired() throws Exception {
        mockMvc.perform(as(me, post("/api/v1/diaries/{id}/image", diaryId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(7, "null", null, null, cooking)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("Idempotency-Key"));
    }

    private ResultActions request(Long memberId, Long diaryId, String json) throws Exception {
        return mockMvc.perform(as(memberId, post("/api/v1/diaries/{id}/image", diaryId))
                .header(DiaryController.IDEMPOTENCY_KEY, UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }

    private static String body(long characterId, String timeOfDay, Long where, Long who, Long what) {
        return """
                {"characterId": %d, "timeOfDay": %s, "whereMyIconId": %s, "whoMyIconId": %s, "whatMyIconId": %s}
                """.formatted(characterId, timeOfDay, where, who, what);
    }

    private MockHttpServletRequestBuilder as(Long memberId, MockHttpServletRequestBuilder request) {
        String token = accessTokens.computeIfAbsent(memberId,
                id -> transactionTemplate.execute(status -> sessionService.start(id)).accessToken());
        return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
    }

    private Long newMember(String subject) {
        return memberRepository.saveAndFlush(
                Member.signUp(subject + "@gmail.com", AuthProvider.GOOGLE, subject, subject)).getId();
    }

}
