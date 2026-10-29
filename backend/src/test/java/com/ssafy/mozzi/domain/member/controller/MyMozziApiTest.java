package com.ssafy.mozzi.domain.member.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.mozzi.domain.auth.service.MemberSessionService;
import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.gacha.entity.CardTier;
import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.support.DiaryFixtures;
import com.ssafy.mozzi.support.GachaFixtures;
import com.ssafy.mozzi.support.IntegrationTest;

/**
 * The my page's mozzi for each emotion: {@code GET /members/me} and
 * {@code PUT /members/me/mozzis/{emotion}}.
 */
@IntegrationTest
@AutoConfigureMockMvc
class MyMozziApiTest {

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

    private GachaFixtures gacha;
    private Long me;
    private String myToken;

    @BeforeEach
    void setUp() {
        new DiaryFixtures(jdbcTemplate).reset();
        gacha = new GachaFixtures(jdbcTemplate);
        gacha.reset();
        me = memberRepository.saveAndFlush(Member.signUp("me@gmail.com", AuthProvider.GOOGLE, "me", "me")).getId();
        gacha.wallet(me);
        myToken = transactionTemplate.execute(status -> sessionService.start(me)).accessToken();
    }

    @AfterEach
    void tearDown() {
        gacha.reset();
    }

    /** Every emotion is listed in order, none picked yet, without the member's cards. */
    @Test
    void listsEveryEmotionWithNothingPickedYet() throws Exception {
        owned("S1-01-07", CardTier.RARE, Emotion.HAPPY);

        getMe()
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.mozzis.length()").value(5))
                .andExpect(jsonPath("$.mozzis[0].emotion").value("HAPPY"))
                .andExpect(jsonPath("$.mozzis[0].selected").doesNotExist())
                .andExpect(jsonPath("$.mozzis[0].cards").doesNotExist())
                .andExpect(jsonPath("$.mozzis[4].emotion").value("ANGRY"));
    }

    @Test
    void aPickShowsAsSelectedAndAPickAgainReplacesIt() throws Exception {
        Long first = owned("S1-01-07", CardTier.RARE, Emotion.HAPPY);
        Long second = owned("S1-01-13", CardTier.COMMON, Emotion.HAPPY);

        choose(Emotion.HAPPY, first).andExpect(status().isNoContent());
        choose(Emotion.HAPPY, second).andExpect(status().isNoContent());

        getMe()
                .andExpect(jsonPath("$.mozzis[0].selected.cardId").value(second))
                .andExpect(jsonPath("$.mozzis[0].selected.tier").value("COMMON"))
                .andExpect(jsonPath("$.mozzis[0].selected.imageUrl").value(
                        "https://mozzi-dev-backend-645819131894.s3.ap-northeast-2.amazonaws.com/cards/S1-01-13_mozzi_happy.png"))
                .andExpect(jsonPath("$.mozzis[1].selected").doesNotExist());
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from my_mozzi_emoticon where member_id = ?", Integer.class, me)).isEqualTo(1);
    }

    @Test
    void aCardNotOwnedCannotBePicked() throws Exception {
        Long notMine = gacha.card("S1-01-07", CardTier.RARE, Emotion.HAPPY, true);

        choose(Emotion.HAPPY, notMine)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CARD_NOT_OWNED"));
    }

    @Test
    void aCardOfAnotherEmotionCannotBePicked() throws Exception {
        Long sad = owned("S1-01-04", CardTier.EPIC, Emotion.SAD);

        choose(Emotion.HAPPY, sad)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("CARD_EMOTION_MISMATCH"));
    }

    @Test
    void withdrawalDeletesThePicks() throws Exception {
        choose(Emotion.HAPPY, owned("S1-01-07", CardTier.RARE, Emotion.HAPPY));

        mockMvc.perform(delete("/api/v1/members/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + myToken))
                .andExpect(status().isNoContent());

        assertThat(jdbcTemplate.queryForList(
                "select card_id from my_mozzi_emoticon where member_id = ?", Long.class, me)).isEqualTo(List.of());
    }

    /** Newest first by default; each card says whether it is equipped. */
    @Test
    void ownedMozzisComeNewestFirst() throws Exception {
        Long older = owned("S2-01-01", CardTier.COMMON, Emotion.HAPPY);
        Long newer = owned("S1-01-04", CardTier.EPIC, Emotion.SAD);
        acquiredDaysAgo(older, 3);
        acquiredDaysAgo(newer, 1);
        choose(Emotion.SAD, newer);

        searchMozzis("")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(2))
                .andExpect(jsonPath("$.cards[0].cardId").value(newer))
                .andExpect(jsonPath("$.cards[0].equipped").value(true))
                .andExpect(jsonPath("$.cards[1].cardId").value(older))
                .andExpect(jsonPath("$.cards[1].equipped").value(false));
        searchMozzis("?sort=OLDEST").andExpect(jsonPath("$.cards[0].cardId").value(older));
    }

    @Test
    void ownedMozzisAreFilteredByTierEmotionAndName() throws Exception {
        Long animal = owned("S1-01-07", CardTier.RARE, Emotion.HAPPY);
        owned("S1-02-07", CardTier.COMMON, Emotion.HAPPY);
        owned("S1-01-04", CardTier.EPIC, Emotion.SAD);

        searchMozzis("?tier=RARE&emotion=HAPPY")
                .andExpect(jsonPath("$.count").value(1))
                .andExpect(jsonPath("$.cards[0].cardId").value(animal));
        searchMozzis("?name= S1-01-07 ")
                .andExpect(jsonPath("$.count").value(1))
                .andExpect(jsonPath("$.cards[0].cardId").value(animal));
    }

    private void acquiredDaysAgo(Long cardId, int days) {
        jdbcTemplate.update("update member_card set first_acquired_at = now() - make_interval(days => ?) "
                + "where member_id = ? and card_id = ?", days, me, cardId);
    }

    private ResultActions searchMozzis(String query) throws Exception {
        return mockMvc.perform(get("/api/v1/members/me/mozzis" + query)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + myToken));
    }

    private Long owned(String code, CardTier tier, Emotion emotion) {
        Long cardId = gacha.card(code, tier, emotion, true);
        gacha.owned(me, cardId);
        return cardId;
    }

    private ResultActions getMe() throws Exception {
        return mockMvc.perform(get("/api/v1/members/me").header(HttpHeaders.AUTHORIZATION, "Bearer " + myToken));
    }

    private ResultActions choose(Emotion emotion, Long cardId) throws Exception {
        return mockMvc.perform(put("/api/v1/members/me/mozzis/" + emotion.name())
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + myToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"cardId\": " + cardId + "}"));
    }

}
