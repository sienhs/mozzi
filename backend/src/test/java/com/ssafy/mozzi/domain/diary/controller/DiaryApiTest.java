package com.ssafy.mozzi.domain.diary.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.endsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.LocalDate;
import java.time.YearMonth;
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
import com.ssafy.mozzi.domain.diary.dto.DiaryCreateRequestDto;
import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.icon.entity.IconCategory;
import com.ssafy.mozzi.domain.image.entity.ImageStatus;
import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.global.security.AccessTokenProvider;
import com.ssafy.mozzi.support.DiaryFixtures;
import com.ssafy.mozzi.support.IntegrationTest;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * {@code /diaries} end to end, against the real schema.
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
    private MemberSessionService sessionService;

    @Autowired
    private AccessTokenProvider accessTokenProvider;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private Clock clock;

    /** One login per member per test; a second login would revoke the first token. */
    private final Map<Long, String> accessTokens = new HashMap<>();

    private DiaryFixtures fixtures;
    private Long me;
    private Long someoneElse;
    private LocalDate today;
    private Long calm;
    private Long sad;
    private Long home;
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
        calm = fixtures.emoticon(Emotion.CALM);
        sad = fixtures.emoticon(Emotion.SAD);
        Long icon = fixtures.icon();
        home = fixtures.myIcon(me, icon, "우리집", IconCategory.WHERE);
        cooking = fixtures.myIcon(me, icon, "요리", IconCategory.WHAT);
        reading = fixtures.myIcon(me, icon, "독서", IconCategory.WHAT);
    }

    @Test
    void writingSavesTodayWithoutAPicture() throws Exception {
        long diaryId = body(create(me, calm, "\"  오므라이스를 만들어 먹었어  \"", home, cooking)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.recordDate").value(today.toString())))
                .get("diaryId").asLong();

        daily(me, today)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.diaryId").value(diaryId))
                .andExpect(jsonPath("$.emoticonId").value(calm))
                .andExpect(jsonPath("$.emotion").value("CALM"))
                .andExpect(jsonPath("$.content").value("오므라이스를 만들어 먹었어"))
                .andExpect(jsonPath("$.myIcons.WHERE[0].myIconId").value(home))
                .andExpect(jsonPath("$.myIcons.WHERE[0].name").value("우리집"))
                .andExpect(jsonPath("$.myIcons.WHERE[0].imageUrl").isNotEmpty())
                .andExpect(jsonPath("$.myIcons.WHO").isEmpty())
                .andExpect(jsonPath("$.myIcons.WHAT[0].myIconId").value(cooking))
                .andExpect(jsonPath("$.image").isEmpty())
                .andExpect(jsonPath("$.createdAt").value(endsWith("+09:00")));
        assertThat(jdbcTemplate.queryForObject("select count(*) from diary_image", Integer.class)).isZero();
    }

    @Test
    void secondDiaryForTheSameDayPointsAtTheFirst() throws Exception {
        long first = body(create(me, calm, "null", cooking)).get("diaryId").asLong();

        create(me, sad, "null", cooking)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("DIARY_ALREADY_EXISTS"))
                .andExpect(jsonPath("$.message").value("오늘은 이미 기록을 남겼어요."))
                .andExpect(jsonPath("$.fieldErrors").isEmpty())
                .andExpect(jsonPath("$.traceId").isNotEmpty())
                .andExpect(jsonPath("$.diaryId").value(first));
    }

    @Test
    void conflictBodyIsJsonWhateverTheClientAccepts() throws Exception {
        long first = body(create(me, calm, "null", cooking)).get("diaryId").asLong();

        mockMvc.perform(as(me, post("/api/v1/diaries"))
                        .header(DiaryController.IDEMPOTENCY_KEY, UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .accept(MediaType.APPLICATION_XML)
                        .content(createBody(sad, "null", cooking)))
                .andExpect(status().isConflict())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.diaryId").value(first));
    }

    @Test
    void idempotencyKeyIsRequired() throws Exception {
        mockMvc.perform(as(me, post("/api/v1/diaries"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(createBody(calm, "null", cooking)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("Idempotency-Key"));
    }

    @Test
    void aWhatIconIsRequired() throws Exception {
        create(me, calm, "null", home)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.message").value(DiaryCreateRequestDto.WHAT_REQUIRED));
        create(me, calm, "null")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(DiaryCreateRequestDto.WHAT_REQUIRED));
    }

    @Test
    void onlyTheMembersLiveIconsCanBeAttached() throws Exception {
        Long theirs = fixtures.myIcon(someoneElse, fixtures.icon(), "회사", IconCategory.WHAT);
        create(me, calm, "null", cooking, theirs)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));

        mockMvc.perform(as(me, delete("/api/v1/my-icons/{id}", reading))).andExpect(status().isNoContent());
        create(me, calm, "null", cooking, reading)
                .andExpect(status().isBadRequest());

        assertThat(jdbcTemplate.queryForObject("select count(*) from diary", Integer.class)).isZero();
    }

    @Test
    void theSameIconTwiceIsRejected() throws Exception {
        create(me, calm, "null", cooking, cooking)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("myIconIds"));
    }

    @Test
    void unknownEmoticonIsNotFound() throws Exception {
        create(me, 999_999L, "null", cooking)
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    /** The limit applies after stripping, so surrounding spaces do not count. */
    @Test
    void contentLengthIsCountedAfterStripping() throws Exception {
        String fifty = "가".repeat(50);

        create(me, calm, "\"" + fifty + "가\"", cooking)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.fieldErrors[0].field").value("content"))
                .andExpect(jsonPath("$.fieldErrors[0].reason").value("50자 이하로 입력해 주세요."));

        create(me, calm, "\"   " + fifty + "   \"", cooking)
                .andExpect(status().isCreated());
    }

    @Test
    void blankContentIsStoredAsNone() throws Exception {
        create(me, calm, "\"   \"", cooking).andExpect(status().isCreated());

        daily(me, today).andExpect(jsonPath("$.content").isEmpty());
    }

    /** Spec: a deleted icon is gone from old diaries too, even when that leaves none. */
    @Test
    void aDeletedIconDisappearsFromOldDiaries() throws Exception {
        create(me, calm, "null", home, cooking).andExpect(status().isCreated());

        mockMvc.perform(as(me, delete("/api/v1/my-icons/{id}", home))).andExpect(status().isNoContent());

        daily(me, today)
                .andExpect(jsonPath("$.myIcons.WHERE").isEmpty())
                .andExpect(jsonPath("$.myIcons.WHAT[0].myIconId").value(cooking));
    }

    @Test
    void aDayWithoutADiaryIsNotFound() throws Exception {
        create(me, calm, "null", cooking).andExpect(status().isCreated());

        daily(me, today.minusDays(1))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
        // Spec 1.3: someone else's day is answered exactly like an empty one.
        daily(someoneElse, today).andExpect(status().isNotFound());
    }

    @Test
    void dailyNeedsAValidDate() throws Exception {
        mockMvc.perform(as(me, get("/api/v1/diaries/daily")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        mockMvc.perform(as(me, get("/api/v1/diaries/daily").param("date", "2026-13-01")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
    }

    @Test
    void monthlyListsTheDaysWrittenInOrder() throws Exception {
        YearMonth month = YearMonth.of(2026, 9);
        Long second = fixtures.diary(me, month.atDay(2), calm, Emotion.CALM);
        Long thirtieth = fixtures.diary(me, month.atDay(30), sad, Emotion.SAD);
        fixtures.diary(me, month.atDay(1).minusDays(1), calm, Emotion.CALM);
        fixtures.diary(me, month.atEndOfMonth().plusDays(1), calm, Emotion.CALM);
        fixtures.diary(someoneElse, month.atDay(3), calm, Emotion.CALM);

        mockMvc.perform(as(me, get("/api/v1/diaries/monthly").param("yearMonth", "2026-09")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.yearMonth").value("2026-09"))
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].diaryId").value(second))
                .andExpect(jsonPath("$.items[0].recordDate").value("2026-09-02"))
                .andExpect(jsonPath("$.items[0].emoticonId").value(calm))
                .andExpect(jsonPath("$.items[0].emotion").value("CALM"))
                .andExpect(jsonPath("$.items[1].diaryId").value(thirtieth))
                .andExpect(jsonPath("$.items[1].emotion").value("SAD"));
    }

    @Test
    void aFutureMonthIsEmpty() throws Exception {
        String next = YearMonth.from(today).plusMonths(1).toString();

        mockMvc.perform(as(me, get("/api/v1/diaries/monthly").param("yearMonth", next)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items").isEmpty());
    }

    @Test
    void monthlyNeedsAValidMonth() throws Exception {
        mockMvc.perform(as(me, get("/api/v1/diaries/monthly")))
                .andExpect(status().isBadRequest());
        mockMvc.perform(as(me, get("/api/v1/diaries/monthly").param("yearMonth", "2026-10-01")))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
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

    /** Convention 4.6: walk more than one page, or a skipped or repeated row goes unnoticed. */
    @Test
    void cursorWalksEveryDiaryOnceNewestFirst() throws Exception {
        List<Long> expected = new ArrayList<>();
        for (int daysAgo = 0; daysAgo < 5; daysAgo++) {
            expected.add(fixtures.diary(me, today.minusDays(daysAgo), calm, Emotion.CALM));
        }
        fixtures.diary(someoneElse, today, calm, Emotion.CALM);

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
        Long recentCalm = fixtures.diary(me, today, calm, Emotion.CALM);
        fixtures.diary(me, today.minusDays(1), sad, Emotion.SAD);
        Long oldCalm = fixtures.diary(me, today.minusDays(40), calm, Emotion.CALM);

        mockMvc.perform(as(me, get("/api/v1/diaries").param("emotion", "CALM")))
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].diaryId").value(recentCalm))
                .andExpect(jsonPath("$.items[1].diaryId").value(oldCalm))
                .andExpect(jsonPath("$.nextCursor").isEmpty());

        mockMvc.perform(as(me, get("/api/v1/diaries")
                        .param("emotion", "CALM")
                        .param("from", today.minusDays(30).toString()).param("to", today.toString())))
                .andExpect(jsonPath("$.items.length()").value(1))
                .andExpect(jsonPath("$.items[0].diaryId").value(recentCalm));
    }

    /** "Happy days only" shows the pictures, so list rows carry the URL once it exists. */
    @Test
    void listRowsCarryTheirPicture() throws Exception {
        Long done = fixtures.diary(me, today, calm, Emotion.CALM);
        fixtures.picture(done, ImageStatus.SUCCEEDED, 0, "https://cdn.test/diary/done.webp");
        Long failed = fixtures.diary(me, today.minusDays(1), calm, Emotion.CALM);
        fixtures.picture(failed, ImageStatus.FAILED, 1, null);
        fixtures.diary(me, today.minusDays(2), calm, Emotion.CALM);

        mockMvc.perform(as(me, get("/api/v1/diaries")))
                .andExpect(jsonPath("$.items[0].image.status").value("SUCCEEDED"))
                .andExpect(jsonPath("$.items[0].image.imageUrl").value("https://cdn.test/diary/done.webp"))
                .andExpect(jsonPath("$.items[1].image.status").value("FAILED"))
                .andExpect(jsonPath("$.items[1].image.imageUrl").isEmpty())
                .andExpect(jsonPath("$.items[2].image").isEmpty());
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

    /** A day's record stays as it was: there is no deleting a diary. */
    @Test
    void diariesCannotBeDeleted() throws Exception {
        long diaryId = body(create(me, calm, "null", cooking)).get("diaryId").asLong();

        mockMvc.perform(as(me, delete("/api/v1/diaries/{id}", diaryId)))
                .andExpect(status().isNotFound());
        daily(me, today).andExpect(jsonPath("$.diaryId").value(diaryId));
    }

    private ResultActions create(Long memberId, Long emoticonId, String content, Long... myIconIds) throws Exception {
        return mockMvc.perform(as(memberId, post("/api/v1/diaries"))
                .header(DiaryController.IDEMPOTENCY_KEY, UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content(createBody(emoticonId, content, myIconIds)));
    }

    private static String createBody(Long emoticonId, String content, Long... myIconIds) {
        return """
                {"emoticonId": %d, "content": %s, "myIconIds": %s}
                """.formatted(emoticonId, content, List.of(myIconIds));
    }

    private ResultActions daily(Long memberId, LocalDate date) throws Exception {
        return mockMvc.perform(as(memberId, get("/api/v1/diaries/daily").param("date", date.toString())));
    }

    private MockHttpServletRequestBuilder as(Long memberId, MockHttpServletRequestBuilder request) {
        String token = accessTokens.computeIfAbsent(memberId,
                id -> transactionTemplate.execute(status -> sessionService.start(id)).accessToken());
        return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
    }

    private JsonNode body(ResultActions result) throws Exception {
        return objectMapper.readTree(result.andReturn().getResponse().getContentAsString());
    }

    private Long newMember(String subject) {
        return memberRepository.saveAndFlush(
                Member.signUp(subject + "@gmail.com", AuthProvider.GOOGLE, subject, subject)).getId();
    }

}
