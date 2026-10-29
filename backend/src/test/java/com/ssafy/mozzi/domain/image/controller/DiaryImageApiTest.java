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
import com.ssafy.mozzi.domain.gacha.entity.CardTier;
import com.ssafy.mozzi.domain.icon.entity.IconCategory;
import com.ssafy.mozzi.domain.image.entity.ImageStatus;
import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.support.DiaryFixtures;
import com.ssafy.mozzi.support.GachaFixtures;
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
        home = fixtures.myIcon(me, "우리집", IconCategory.WHERE);
        mom = fixtures.myIcon(me, "엄마", IconCategory.WHO);
        cooking = fixtures.myIcon(me, "요리", IconCategory.WHAT);
        reading = fixtures.myIcon(me, "독서", IconCategory.WHAT);
        diaryId = fixtures.diary(me, today, fixtures.emoticon(Emotion.CALM), Emotion.CALM);
        fixtures.attach(diaryId, home);
        fixtures.attach(diaryId, mom);
        fixtures.attach(diaryId, cooking);
        fixtures.attach(diaryId, reading);
    }

    @Test
    void requestingStoresWhatWasPickedAndStartsThePicture() throws Exception {
        request(me, diaryId, body(7, "\"EVENING\"", "\"RAINY\"", home, mom, cooking))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.diaryId").value(diaryId))
                .andExpect(jsonPath("$.imageStatus").value("PENDING"));

        Map<String, Object> row = jdbcTemplate.queryForMap("select * from diary_image where diary_id = ?", diaryId);
        assertThat(row)
                .containsEntry("status", "PENDING")
                .containsEntry("failure_count", 0)
                .containsEntry("character_id", 7L)
                .containsEntry("mozzi_card_id", null)
                .containsEntry("time_of_day", "EVENING")
                .containsEntry("weather", "RAINY")
                .containsEntry("where_name", "우리집")
                .containsEntry("who_name", "엄마")
                .containsEntry("what_name", "요리");
        mockMvc.perform(as(me, get("/api/v1/diaries/daily").param("date", today.toString())))
                .andExpect(jsonPath("$.image.status").value("PENDING"))
                .andExpect(jsonPath("$.image.imageUrl").isEmpty());
    }

    @Test
    void onlyCharacterAndWhatAreRequired() throws Exception {
        request(me, diaryId, body(7, "null", "null", null, null, cooking))
                .andExpect(status().isAccepted());
        assertThat(jdbcTemplate.queryForObject(
                "select weather from diary_image where diary_id = ?", String.class, diaryId))
                .isEqualTo("NONE");

        request(me, diaryId, """
                {"timeOfDay": "MORNING", "whatMyIconId": %d}
                """.formatted(cooking))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("characterId"));
    }

    @Test
    void whatIsRequired() throws Exception {
        request(me, diaryId, body(7, "null", "null", home, null, null))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("whatMyIconId"));
    }

    @Test
    void iconsMustBeTheDiarysOwnInTheirCategory() throws Exception {
        Long notOnDiary = fixtures.myIcon(me, "운동", IconCategory.WHAT);

        request(me, diaryId, body(7, "null", "null", null, null, notOnDiary))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        // A WHAT icon sent as WHERE.
        request(me, diaryId, body(7, "null", "null", reading, null, cooking))
                .andExpect(status().isBadRequest());
        assertThat(jdbcTemplate.queryForObject("select count(*) from diary_image", Integer.class)).isZero();
    }

    @Test
    void aSecondRequestWhileDrawingIsRejected() throws Exception {
        request(me, diaryId, body(7, "null", "null", null, null, cooking)).andExpect(status().isAccepted());

        request(me, diaryId, body(7, "null", "null", null, null, reading))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IMAGE_ALREADY_REQUESTED"));
    }

    /** The replay is the first response as sent, even after the picture moved on. */
    @Test
    void aResendWithTheSameKeyReplaysTheFirstResponse() throws Exception {
        String key = UUID.randomUUID().toString();
        String picks = body(7, "null", "null", null, null, cooking);
        request(me, diaryId, picks, key).andExpect(status().isAccepted());
        jdbcTemplate.update("update diary_image set status = 'SUCCEEDED' where diary_id = ?", diaryId);

        request(me, diaryId, picks, key)
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.imageStatus").value("PENDING"));
        request(me, diaryId, body(7, "null", "null", null, null, reading), key)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_CONFLICT"));
    }

    /** The body does not name the diary, so the key is scoped per diary through the path. */
    @Test
    void theSameKeyOnAnotherDiaryIsANewRequest() throws Exception {
        Long yesterday = fixtures.diary(me, today.minusDays(1), fixtures.emoticon(Emotion.SAD), Emotion.SAD);
        fixtures.attach(yesterday, cooking);
        String key = UUID.randomUUID().toString();
        String picks = body(7, "null", "null", null, null, cooking);
        request(me, diaryId, picks, key).andExpect(status().isAccepted());

        request(me, yesterday, picks, key)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("IMAGE_ONLY_TODAY"));
    }

    @Test
    void aFinishedPictureIsNotRedrawn() throws Exception {
        fixtures.picture(diaryId, ImageStatus.SUCCEEDED, 0, "https://cdn.test/diary/done.webp");

        request(me, diaryId, body(7, "null", "null", null, null, cooking))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IMAGE_ALREADY_REQUESTED"));
    }

    @Test
    void aFailedPictureCanBeRequestedAgainWithNewPicks() throws Exception {
        fixtures.picture(diaryId, ImageStatus.FAILED, 2, null);

        request(me, diaryId, body(9, "\"LUNCH\"", "\"SUNNY\"", null, null, reading))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.imageStatus").value("PENDING"));

        Map<String, Object> row = jdbcTemplate.queryForMap("select * from diary_image where diary_id = ?", diaryId);
        assertThat(row)
                .containsEntry("status", "PENDING")
                .containsEntry("failure_count", 2)
                .containsEntry("character_id", 9L)
                .containsEntry("time_of_day", "LUNCH")
                .containsEntry("weather", "SUNNY")
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

        request(me, yesterday, body(7, "null", "null", null, null, cooking))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("IMAGE_ONLY_TODAY"));

        fixtures.picture(yesterday, ImageStatus.FAILED, 1, null);
        request(me, yesterday, body(7, "null", "null", null, null, cooking))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("IMAGE_ONLY_TODAY"));
    }

    @Test
    void threeFailuresAreTheLimit() throws Exception {
        fixtures.picture(diaryId, ImageStatus.FAILED, 3, null);

        request(me, diaryId, body(7, "null", "null", null, null, cooking))
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.code").value("RETRY_LIMIT_EXCEEDED"));
    }

    @Test
    void anotherMembersDiaryIsNotFound() throws Exception {
        request(someoneElse, diaryId, body(7, "null", "null", null, null, cooking))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void idempotencyKeyIsRequired() throws Exception {
        mockMvc.perform(as(me, post("/api/v1/diaries/{id}/image", diaryId))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body(7, "null", "null", null, null, cooking)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("Idempotency-Key"));
    }

    /** The temporary test API ignores the day, a finished picture and the failure cap. */
    @Test
    void theTestApiRedrawsAFinishedPictureOfAPastDiary() throws Exception {
        Long yesterday = fixtures.diary(me, today.minusDays(1), fixtures.emoticon(Emotion.SAD), Emotion.SAD);
        fixtures.attach(yesterday, cooking);
        fixtures.picture(yesterday, ImageStatus.SUCCEEDED, 0, "https://cdn.test/diary/done.webp");

        requestForTest(me, yesterday, body(9, "null", "null", null, null, cooking))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.imageStatus").value("PENDING"));

        Map<String, Object> row = jdbcTemplate.queryForMap("select * from diary_image where diary_id = ?", yesterday);
        assertThat(row)
                .containsEntry("status", "PENDING")
                .containsEntry("character_id", 9L)
                .containsEntry("image_url", null);
        assertThat(jdbcTemplate.queryForObject("select count(*) from diary_image where diary_id = ?",
                Integer.class, yesterday)).isOne();
    }

    @Test
    void theTestApiIgnoresTheFailureCap() throws Exception {
        fixtures.picture(diaryId, ImageStatus.FAILED, 3, null);

        requestForTest(me, diaryId, body(7, "null", "null", null, null, cooking))
                .andExpect(status().isAccepted());
        assertThat(jdbcTemplate.queryForObject(
                "select failure_count from diary_image where diary_id = ?", Integer.class, diaryId))
                .isEqualTo(3);
    }

    @Test
    void theTestApiStillRejectsARequestWhileDrawing() throws Exception {
        requestForTest(me, diaryId, body(7, "null", "null", null, null, cooking)).andExpect(status().isAccepted());

        requestForTest(me, diaryId, body(7, "null", "null", null, null, reading))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IMAGE_ALREADY_REQUESTED"));
        requestForTest(someoneElse, diaryId, body(7, "null", "null", null, null, cooking))
                .andExpect(status().isNotFound());
    }

    /** The member's mozzi for the diary's emotion goes into the picture, whatever characterId says. */
    @Test
    void theMozziPickedForTheDiarysEmotionIsStored() throws Exception {
        GachaFixtures gacha = new GachaFixtures(jdbcTemplate);
        gacha.reset();
        try {
            Long calm = gacha.card("S1-01-02", CardTier.LEGENDARY, Emotion.CALM, true);
            gacha.owned(me, calm);
            jdbcTemplate.update("""
                    insert into my_mozzi_emoticon (member_id, emotion, card_id, updated_at)
                    values (?, 'CALM', ?, now())
                    """, me, calm);

            request(me, diaryId, body(7, "null", "null", null, null, cooking)).andExpect(status().isAccepted());

            assertThat(jdbcTemplate.queryForMap(
                    "select character_id, mozzi_card_id from diary_image where diary_id = ?", diaryId))
                    .containsEntry("character_id", 7L)
                    .containsEntry("mozzi_card_id", calm);
        } finally {
            gacha.reset();
        }
    }

    private ResultActions requestForTest(Long memberId, Long diaryId, String json) throws Exception {
        return mockMvc.perform(as(memberId, post("/api/v1/diaries/{id}/image/test", diaryId))
                .header(DiaryController.IDEMPOTENCY_KEY, UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }

    private ResultActions request(Long memberId, Long diaryId, String json) throws Exception {
        return request(memberId, diaryId, json, UUID.randomUUID().toString());
    }

    private ResultActions request(Long memberId, Long diaryId, String json, String key) throws Exception {
        return mockMvc.perform(as(memberId, post("/api/v1/diaries/{id}/image", diaryId))
                .header(DiaryController.IDEMPOTENCY_KEY, key)
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }

    private static String body(
            long characterId, String timeOfDay, String weather, Long where, Long who, Long what) {
        return """
                {"characterId": %d, "timeOfDay": %s, "weather": %s, "whereMyIconId": %s, "whoMyIconId": %s, "whatMyIconId": %s}
                """.formatted(characterId, timeOfDay, weather, where, who, what);
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
