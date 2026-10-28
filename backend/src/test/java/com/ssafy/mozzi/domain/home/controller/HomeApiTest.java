package com.ssafy.mozzi.domain.home.controller;

import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.mozzi.domain.auth.service.MemberSessionService;
import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.icon.entity.IconCategory;
import com.ssafy.mozzi.domain.image.entity.ImageStatus;
import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.support.DiaryFixtures;
import com.ssafy.mozzi.support.IntegrationTest;

/**
 * {@code GET /home} end to end.
 */
@IntegrationTest
@AutoConfigureMockMvc
class HomeApiTest {

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
    private Long calm;

    @BeforeEach
    void setUp() {
        fixtures = new DiaryFixtures(jdbcTemplate);
        fixtures.reset();
        me = newMember("me");
        someoneElse = newMember("someoneElse");
        accessTokens.clear();
        today = LocalDate.now(clock);
        calm = fixtures.emoticon(Emotion.CALM);
    }

    @Test
    void beforeWritingShowsTheLatestEarlierDiaryWithItsIcons() throws Exception {
        fixtures.diary(me, today.minusDays(5), calm, Emotion.CALM, "오래된 기록");
        Long yesterday = fixtures.diary(me, today.minusDays(1), calm, Emotion.CALM, "조금 늦었던 퇴근");
        fixtures.attach(yesterday, fixtures.myIcon(me, "업무", IconCategory.WHAT));
        fixtures.diary(someoneElse, today, calm, Emotion.CALM, "남의 오늘");
        fixtures.diary(someoneElse, today.minusDays(1), calm, Emotion.CALM, "남의 어제");

        home(me)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.today").value(today.toString()))
                .andExpect(jsonPath("$.todayStatus").value("NOT_RECORDED"))
                .andExpect(jsonPath("$.todayDiary").hasJsonPath())
                .andExpect(jsonPath("$.todayDiary").value(nullValue()))
                .andExpect(jsonPath("$.canRequestImage").value(false))
                .andExpect(jsonPath("$.recentDiary.diaryId").value(yesterday))
                .andExpect(jsonPath("$.recentDiary.content").value("조금 늦었던 퇴근"))
                .andExpect(jsonPath("$.recentDiary.myIcons.WHAT[0].name").value("업무"));
    }

    @Test
    void aNewMemberHasNothingToShow() throws Exception {
        home(me)
                .andExpect(jsonPath("$.todayStatus").value("NOT_RECORDED"))
                .andExpect(jsonPath("$.recentDiary").hasJsonPath())
                .andExpect(jsonPath("$.recentDiary").value(nullValue()));
    }

    @Test
    void aDiaryWhosePictureNeverArrivedCanAskForOne() throws Exception {
        writtenToday();

        home(me)
                .andExpect(jsonPath("$.todayStatus").value("IMAGE_NOT_REQUESTED"))
                .andExpect(jsonPath("$.todayDiary.image").hasJsonPath())
                .andExpect(jsonPath("$.todayDiary.image").value(nullValue()))
                .andExpect(jsonPath("$.canRequestImage").value(true));
    }

    /** {@code POST /diaries/{id}/image} needs a live "what" icon of the diary. */
    @Test
    void cannotAskForAPictureOnceTheLastWhatIconIsDeleted() throws Exception {
        Long diaryId = fixtures.diary(me, today, calm, Emotion.CALM);
        Long what = fixtures.myIcon(me, "요리", IconCategory.WHAT);
        fixtures.attach(diaryId, what);
        fixtures.picture(diaryId, ImageStatus.FAILED, 1, null);
        jdbcTemplate.update("update my_icon set deleted_at = now() where my_icon_id = ?", what);

        home(me)
                .andExpect(jsonPath("$.todayStatus").value("IMAGE_FAILED"))
                .andExpect(jsonPath("$.canRequestImage").value(false));
    }

    @Test
    void pendingPicture() throws Exception {
        fixtures.picture(writtenToday(), ImageStatus.PENDING, 0, null);

        home(me)
                .andExpect(jsonPath("$.todayStatus").value("IMAGE_PENDING"))
                .andExpect(jsonPath("$.canRequestImage").value(false));
    }

    @Test
    void finishedPicture() throws Exception {
        fixtures.picture(writtenToday(),
                ImageStatus.SUCCEEDED, 0, "https://cdn.test/diary/1.webp");

        home(me)
                .andExpect(jsonPath("$.todayStatus").value("COMPLETED"))
                .andExpect(jsonPath("$.todayDiary.image.imageUrl").value("https://cdn.test/diary/1.webp"))
                .andExpect(jsonPath("$.canRequestImage").value(false));
    }

    @Test
    void failedPictureCanBeRetriedUntilTheThirdFailure() throws Exception {
        Long diaryId = writtenToday();
        fixtures.picture(diaryId, ImageStatus.FAILED, 2, null);

        home(me)
                .andExpect(jsonPath("$.todayStatus").value("IMAGE_FAILED"))
                .andExpect(jsonPath("$.canRequestImage").value(true));

        jdbcTemplate.update("update diary_image set failure_count = 3 where diary_id = ?", diaryId);

        home(me)
                .andExpect(jsonPath("$.todayStatus").value("IMAGE_FAILED"))
                .andExpect(jsonPath("$.canRequestImage").value(false));
    }

    @Test
    void requiresAnAccessToken() throws Exception {
        mockMvc.perform(get("/api/v1/home")).andExpect(status().isUnauthorized());
    }

    /** Today's diary with a "what" icon, as every saved diary starts out. */
    private Long writtenToday() {
        Long diaryId = fixtures.diary(me, today, calm, Emotion.CALM);
        fixtures.attach(diaryId, fixtures.myIcon(me, "요리", IconCategory.WHAT));
        return diaryId;
    }

    private ResultActions home(Long memberId) throws Exception {
        String token = accessTokens.computeIfAbsent(memberId,
                id -> transactionTemplate.execute(status -> sessionService.start(id)).accessToken());
        return mockMvc.perform(get("/api/v1/home").header(HttpHeaders.AUTHORIZATION, "Bearer " + token));
    }

    private Long newMember(String subject) {
        return memberRepository.saveAndFlush(
                Member.signUp(subject + "@gmail.com", AuthProvider.GOOGLE, subject, subject)).getId();
    }

}
