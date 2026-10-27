package com.ssafy.mozzi.domain.diary.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.endsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
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
import com.ssafy.mozzi.domain.diary.entity.ActivityCode;
import com.ssafy.mozzi.domain.diary.entity.Diary;
import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.diary.repository.ActivityRepository;
import com.ssafy.mozzi.domain.diary.repository.DiaryRepository;
import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.global.security.AccessTokenProvider;
import com.ssafy.mozzi.support.IntegrationTest;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * API spec 4.4 end to end, against the real schema.
 *
 * <p>Requests go through the real authentication filter: {@link #as} logs the member in
 * through {@link MemberSessionService} and sends its access token.
 */
@IntegrationTest
@AutoConfigureMockMvc
class DiaryApiTest {

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
    private AccessTokenProvider accessTokenProvider;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private Clock clock;

    /** One login per member per test; a second login would revoke the first token. */
    private final Map<Long, String> accessTokens = new HashMap<>();

    private Long me;
    private Long someoneElse;
    private LocalDate today;

    @BeforeEach
    void setUp() {
        // Cascades to diary, diary_activity and diary_image; the seeded activity rows stay.
        jdbcTemplate.execute("truncate table member cascade");
        me = newMember("me");
        someoneElse = newMember("someoneElse");
        accessTokens.clear();
        today = LocalDate.now(clock);
    }

    @Test
    void savingADiaryQueuesItsFirstPicture() throws Exception {
        JsonNode created = body(create(me, today, "CALM", "[\"FAMILY\", \"REST\"]", "\"  오므라이스를 만들어 먹었어  \"")
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.recordDate").value(today.toString()))
                .andExpect(jsonPath("$.image.status").value("PENDING")));

        long diaryId = created.get("diaryId").asLong();
        long imageId = created.get("image").get("imageId").asLong();
        assertThat(jdbcTemplate.queryForObject(
                "select status from diary_image where diary_image_id = ?", String.class, imageId))
                .isEqualTo("PENDING");

        mockMvc.perform(as(me, get("/api/v1/diaries/{id}", diaryId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emotion").value("CALM"))
                // Chip order from the activity table, not the order they were sent in.
                .andExpect(jsonPath("$.activities[0]").value("REST"))
                .andExpect(jsonPath("$.activities[1]").value("FAMILY"))
                .andExpect(jsonPath("$.memo").value("오므라이스를 만들어 먹었어"))
                .andExpect(jsonPath("$.title").isEmpty())
                .andExpect(jsonPath("$.image.imageId").value(imageId))
                .andExpect(jsonPath("$.image.status").value("PENDING"))
                .andExpect(jsonPath("$.image.imageUrl").isEmpty())
                .andExpect(jsonPath("$.image.imageUrlExpiresAt").isEmpty())
                .andExpect(jsonPath("$.createdAt").value(endsWith("+09:00")));
    }

    @Test
    void secondDiaryForTheSameDayPointsAtTheFirst() throws Exception {
        long first = body(create(me, today, "CALM", "[]", "null")).get("diaryId").asLong();

        create(me, today, "SAD", "[]", "null")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DIARY_ALREADY_EXISTS"))
                .andExpect(jsonPath("$.message").value("오늘은 이미 기록을 남겼어요."))
                .andExpect(jsonPath("$.fieldErrors").isEmpty())
                .andExpect(jsonPath("$.traceId").isNotEmpty())
                .andExpect(jsonPath("$.diaryId").value(first));
    }

    @Test
    void conflictBodyIsJsonWhateverTheClientAccepts() throws Exception {
        long first = body(create(me, today, "CALM", "[]", "null")).get("diaryId").asLong();

        mockMvc.perform(as(me, post("/api/v1/diaries"))
                .header(DiaryController.IDEMPOTENCY_KEY, UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .accept(MediaType.APPLICATION_XML)
                .content(createBody(today, "SAD", "[]", "null")))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.diaryId").value(first));
    }

    @Test
    void onlyTodayCanBeWritten() throws Exception {
        create(me, today.minusDays(2), "CALM", "[]", "null")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_RECORD_DATE"));
    }

    @Test
    void idempotencyKeyIsRequired() throws Exception {
        mockMvc.perform(as(me, post("/api/v1/diaries"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(today, "CALM", "[]", "null")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("Idempotency-Key"));
    }

    @Test
    void zeroActivitiesIsAllowed() throws Exception {
        long diaryId = body(create(me, today, "NEUTRAL", "[]", "null")
                .andExpect(status().isCreated())).get("diaryId").asLong();

        mockMvc.perform(as(me, get("/api/v1/diaries/{id}", diaryId)))
                .andExpect(jsonPath("$.activities").isEmpty())
                .andExpect(jsonPath("$.memo").isEmpty());
    }

    @Test
    void theSameActivityTwiceIsRejected() throws Exception {
        create(me, today, "CALM", "[\"REST\", \"REST\"]", "null")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("activities"));
    }

    /** The limit applies after stripping, so surrounding spaces do not count. */
    @Test
    void memoLengthIsCountedAfterStripping() throws Exception {
        String hundred = "가".repeat(100);

        create(me, today, "CALM", "[]", "\"" + hundred + "가\"")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("memo"))
                .andExpect(jsonPath("$.fieldErrors[0].reason").value("100자 이하로 입력해 주세요."));

        create(me, today, "CALM", "[]", "\"   " + hundred + "   \"")
                .andExpect(status().isCreated());
    }

    @Test
    void requestsWithoutAMemberAreUnauthorized() throws Exception {
        mockMvc.perform(get("/api/v1/diaries"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("ACCESS_TOKEN_MISSING"));
        // Correctly signed, but not the member's current session.
        String stale = accessTokenProvider.issue(me, UUID.randomUUID()).token();
        mockMvc.perform(get("/api/v1/diaries").header(HttpHeaders.AUTHORIZATION, "Bearer " + stale))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REVOKED"));
    }

    /** Spec 1.3: someone else's diary is answered exactly like a missing one. */
    @Test
    void anotherMembersDiaryIsNotFound() throws Exception {
        long diaryId = body(create(me, today, "CALM", "[]", "null")).get("diaryId").asLong();

        mockMvc.perform(as(someoneElse, get("/api/v1/diaries/{id}", diaryId)))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        mockMvc.perform(as(someoneElse, patch("/api/v1/diaries/{id}", diaryId))
                        .contentType(MediaType.APPLICATION_JSON).content("{\"emotion\": \"SAD\"}"))
                .andExpect(status().isNotFound());
        mockMvc.perform(as(someoneElse, delete("/api/v1/diaries/{id}", diaryId)))
                .andExpect(status().isNotFound());

        mockMvc.perform(as(me, get("/api/v1/diaries/{id}", diaryId)))
                .andExpect(jsonPath("$.emotion").value("CALM"));
    }

    @Test
    void patchChangesOnlyTheFieldsSent() throws Exception {
        long diaryId = body(create(me, today, "CALM", "[\"REST\"]", "\"처음 메모\"")).get("diaryId").asLong();

        patchDiary(diaryId, "{\"emotion\": \"HAPPY\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emotion").value("HAPPY"))
                .andExpect(jsonPath("$.activities[0]").value("REST"))
                .andExpect(jsonPath("$.memo").value("처음 메모"));

        patchDiary(diaryId, "{\"memo\": \"   \", \"activities\": []}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emotion").value("HAPPY"))
                .andExpect(jsonPath("$.activities").isEmpty())
                .andExpect(jsonPath("$.memo").isEmpty());
    }

    @Test
    void patchCannotMoveADiaryToAnotherDay() throws Exception {
        long diaryId = body(create(me, today, "CALM", "[]", "null")).get("diaryId").asLong();

        patchDiary(diaryId, "{\"recordDate\": \"" + today.minusDays(1) + "\"}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
    }

    /** Changing only the activities touches no column of diary itself, but it is still an edit. */
    @Test
    void changingOnlyActivitiesMovesUpdatedAt() throws Exception {
        long diaryId = body(create(me, today, "CALM", "[\"REST\"]", "null")).get("diaryId").asLong();
        OffsetDateTime before = OffsetDateTime.parse(body(mockMvc.perform(
                as(me, get("/api/v1/diaries/{id}", diaryId)))).get("updatedAt").asString());

        OffsetDateTime after = OffsetDateTime.parse(body(patchDiary(diaryId, "{\"activities\": [\"WORK\"]}")
                .andExpect(status().isOk())).get("updatedAt").asString());

        assertThat(after).isAfter(before);
    }

    /** Soft delete frees the day again (policy 6). */
    @Test
    void aDeletedDayCanBeWrittenAgain() throws Exception {
        long diaryId = body(create(me, today, "CALM", "[]", "null")).get("diaryId").asLong();

        mockMvc.perform(as(me, delete("/api/v1/diaries/{id}", diaryId)))
                .andExpect(status().isNoContent());
        mockMvc.perform(as(me, get("/api/v1/diaries/{id}", diaryId)))
                .andExpect(status().isNotFound());
        assertThat(jdbcTemplate.queryForObject(
                "select deleted_at is not null from diary where diary_id = ?", Boolean.class, diaryId))
                .isTrue();

        create(me, today, "SAD", "[]", "null").andExpect(status().isCreated());
    }

    /** Convention 4.6: walk more than one page, or a skipped or repeated row goes unnoticed. */
    @Test
    void cursorWalksEveryDiaryOnceNewestFirst() throws Exception {
        List<Long> expected = new ArrayList<>();
        for (int daysAgo = 0; daysAgo < 5; daysAgo++) {
            expected.add(insertDiary(me, today.minusDays(daysAgo), Emotion.CALM, List.of()).getId());
        }
        insertDiary(someoneElse, today, Emotion.CALM, List.of());

        List<Long> seen = new ArrayList<>();
        String cursor = null;
        int pages = 0;
        do {
            MockHttpServletRequestBuilder request = as(me, get("/api/v1/diaries").param("size", "2"));
            if (cursor != null) {
                request.param("cursor", cursor);
            }
            JsonNode page = body(mockMvc.perform(request).andExpect(status().isOk()));
            page.get("items").forEach(item -> seen.add(item.get("diaryId").asLong()));
            cursor = page.get("nextCursor").isNull() ? null : page.get("nextCursor").asString();
            pages++;
        } while (cursor != null);

        assertThat(seen).containsExactlyElementsOf(expected);
        assertThat(pages).isEqualTo(3);
    }

    @Test
    void listFiltersCombine() throws Exception {
        Diary calmFamily = insertDiary(me, today, Emotion.CALM, List.of(ActivityCode.FAMILY, ActivityCode.REST));
        insertDiary(me, today.minusDays(1), Emotion.CALM, List.of(ActivityCode.WORK));
        insertDiary(me, today.minusDays(2), Emotion.SAD, List.of(ActivityCode.FAMILY));
        Diary oldCalmFamily = insertDiary(me, today.minusDays(40), Emotion.CALM, List.of(ActivityCode.FAMILY));

        mockMvc.perform(as(me, get("/api/v1/diaries").param("emotion", "CALM").param("activity", "FAMILY")))
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].diaryId").value(calmFamily.getId()))
                .andExpect(jsonPath("$.items[0].activities[0]").value("REST"))
                .andExpect(jsonPath("$.items[0].activities[1]").value("FAMILY"))
                .andExpect(jsonPath("$.items[1].diaryId").value(oldCalmFamily.getId()))
                .andExpect(jsonPath("$.nextCursor").isEmpty());

        mockMvc.perform(as(me, get("/api/v1/diaries")
                        .param("emotion", "CALM").param("activity", "FAMILY")
                        .param("from", today.minusDays(30).toString()).param("to", today.toString())))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].diaryId").value(calmFamily.getId()));
    }

    /** Summary leaves out memo, updatedAt and the image URL (spec 4.4). */
    @Test
    void summaryCarriesNoMemoOrImageUrl() throws Exception {
        create(me, today, "CALM", "[]", "\"비밀 메모\"");

        JsonNode item = body(mockMvc.perform(as(me, get("/api/v1/diaries")))).get("items").get(0);

        assertThat(item.has("memo")).isFalse();
        assertThat(item.has("updatedAt")).isFalse();
        assertThat(item.get("image").has("imageUrl")).isFalse();
        assertThat(item.get("image").get("status").asString()).isEqualTo("PENDING");
    }

    @Test
    void brokenCursorIsRejectedRatherThanRestarting() throws Exception {
        mockMvc.perform(as(me, get("/api/v1/diaries").param("cursor", "not-a-cursor")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
    }

    @Test
    void pageSizeIsCapped() throws Exception {
        mockMvc.perform(as(me, get("/api/v1/diaries").param("size", "101")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("size"));
    }

    @Test
    void reversedPeriodIsRejected() throws Exception {
        mockMvc.perform(as(me, get("/api/v1/diaries")
                        .param("from", today.toString()).param("to", today.minusDays(1).toString())))
                .andExpect(status().isBadRequest());
    }

    private ResultActions create(Long memberId, LocalDate recordDate, String emotion, String activities, String memo)
            throws Exception {
        return mockMvc.perform(as(memberId, post("/api/v1/diaries"))
                .header(DiaryController.IDEMPOTENCY_KEY, UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(createBody(recordDate, emotion, activities, memo)));
    }

    private static String createBody(LocalDate recordDate, String emotion, String activities, String memo) {
        return """
                {"recordDate": "%s", "emotion": "%s", "activities": %s, "memo": %s}
                """.formatted(recordDate, emotion, activities, memo);
    }

    private ResultActions patchDiary(long diaryId, String json) throws Exception {
        return mockMvc.perform(as(me, patch("/api/v1/diaries/{id}", diaryId))
                .contentType(MediaType.APPLICATION_JSON)
                .content(json));
    }

    private MockHttpServletRequestBuilder as(Long memberId, MockHttpServletRequestBuilder request) {
        String token = accessTokens.computeIfAbsent(memberId,
                id -> transactionTemplate.execute(status -> sessionService.start(id)).accessToken());
        return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
    }

    private JsonNode body(ResultActions result) throws Exception {
        return objectMapper.readTree(result.andReturn().getResponse().getContentAsString());
    }

    private Diary insertDiary(Long memberId, LocalDate recordDate, Emotion emotion, List<ActivityCode> codes) {
        return diaryRepository.saveAndFlush(Diary.create(
                memberId, recordDate, emotion, null,
                codes.isEmpty() ? List.of() : activityRepository.findByCodeInAndActiveTrue(codes)));
    }

    private Long newMember(String subject) {
        return memberRepository.saveAndFlush(
                Member.signUp(subject + "@gmail.com", AuthProvider.GOOGLE, subject, subject)).getId();
    }

}
