package com.ssafy.mozzi.domain.gacha.controller;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.doAnswer;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayDeque;
import java.util.Deque;
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
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.mozzi.domain.auth.service.MemberSessionService;
import com.ssafy.mozzi.domain.gacha.entity.CardTier;
import com.ssafy.mozzi.domain.gacha.service.RandomSource;
import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.global.idempotency.IdempotencyStore;
import com.ssafy.mozzi.support.DiaryFixtures;
import com.ssafy.mozzi.support.GachaFixtures;
import com.ssafy.mozzi.support.IntegrationTest;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * {@code /gacha} and {@code /rewards} end to end, against the real schema.
 *
 * <p>Randomness is scripted: each draw takes a tier roll (see the {@code ROLL_*} constants)
 * and then a card index within the candidates. An exhausted script answers 0.
 */
@IntegrationTest
@AutoConfigureMockMvc
class GachaApiTest {

    private static final int ROLL_COMMON = 0;
    private static final int ROLL_EPIC = 80_000;
    private static final int ROLL_LEGENDARY = 95_000;

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
    private RandomSource random;

    private final Deque<Integer> script = new ArrayDeque<>();
    private final Map<Long, String> accessTokens = new HashMap<>();

    private GachaFixtures gacha;
    private Long me;

    @BeforeEach
    void setUp() {
        new DiaryFixtures(jdbcTemplate).reset();
        gacha = new GachaFixtures(jdbcTemplate);
        gacha.reset();
        accessTokens.clear();
        script.clear();
        doAnswer(invocation -> script.isEmpty() ? 0 : script.poll()).when(random).nextInt(anyInt());
        me = memberRepository.saveAndFlush(Member.signUp("me@gmail.com", AuthProvider.GOOGLE, "me", "me")).getId();
    }

    // ---- reads

    @Test
    void statusShowsTheWalletAndProgressOverActiveCards() throws Exception {
        gacha.wallet(me, 23, 140);
        Long owned = gacha.card("S2-01-01", CardTier.COMMON);
        gacha.card("S2-01-02", CardTier.COMMON);
        Long retired = gacha.card("S2-01-03", CardTier.COMMON, false);
        gacha.owned(me, owned);
        gacha.owned(me, retired);

        mockMvc.perform(as(me, get("/api/v1/gacha/status")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ticketCount").value(23))
                .andExpect(jsonPath("$.shardCount").value(140))
                .andExpect(jsonPath("$.collection.owned").value(1))
                .andExpect(jsonPath("$.collection.total").value(2))
                .andExpect(jsonPath("$.season").doesNotExist());
    }

    @Test
    void ratesAreTheTierWeights() throws Exception {
        mockMvc.perform(as(me, get("/api/v1/gacha/rates")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.rates.length()").value(5))
                .andExpect(jsonPath("$.rates[0].tier").value("COMMON"))
                .andExpect(jsonPath("$.rates[0].rate").value(0.45))
                .andExpect(jsonPath("$.rates[0].duplicateShards").value(1))
                .andExpect(jsonPath("$.rates[1].tier").value("RARE"))
                .andExpect(jsonPath("$.rates[1].rate").value(0.325))
                .andExpect(jsonPath("$.rates[3].tier").value("LEGENDARY"))
                .andExpect(jsonPath("$.rates[3].rate").value(0.05))
                .andExpect(jsonPath("$.rates[4].tier").value("MYTHIC"))
                .andExpect(jsonPath("$.rates[4].rate").value(0.005))
                .andExpect(jsonPath("$.rates[4].duplicateShards").value(40));
    }

    @Test
    void collectionListsEveryActiveCardRarestFirst() throws Exception {
        gacha.wallet(me, 0, 140);
        Long common = gacha.card("S2-01-01", CardTier.COMMON);
        gacha.card("S2-02-01", CardTier.LEGENDARY);
        gacha.card("S2-01-02", CardTier.LEGENDARY);
        gacha.card("S2-09-01", CardTier.MYTHIC);
        gacha.card("S2-09-02", CardTier.MYTHIC, false);
        gacha.owned(me, common);

        mockMvc.perform(as(me, get("/api/v1/gacha/collection")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.owned").value(1))
                .andExpect(jsonPath("$.total").value(4))
                .andExpect(jsonPath("$.shardCount").value(140))
                .andExpect(jsonPath("$.cards.length()").value(4))
                .andExpect(jsonPath("$.cards[0].code").value("S2-09-01"))
                .andExpect(jsonPath("$.cards[1].code").value("S2-01-02"))
                .andExpect(jsonPath("$.cards[2].code").value("S2-02-01"))
                .andExpect(jsonPath("$.cards[3].code").value("S2-01-01"))
                // A card the member lacks still has its name and picture, for the exchange screen.
                .andExpect(jsonPath("$.cards[0].owned").value(false))
                .andExpect(jsonPath("$.cards[0].ownedCount").value(0))
                .andExpect(jsonPath("$.cards[0].name").value("모찌 S2-09-01"))
                .andExpect(jsonPath("$.cards[0].imageUrl").value(
                        "https://mozzi-dev-backend-645819131894.s3.ap-northeast-2.amazonaws.com/cards/S2-09-01_mozzi_happy.png"))
                .andExpect(jsonPath("$.cards[0].exchangeCost").value(400))
                .andExpect(jsonPath("$.cards[1].exchangeCost").value(200))
                .andExpect(jsonPath("$.cards[3].owned").value(true))
                .andExpect(jsonPath("$.cards[3].exchangeCost").isEmpty());

        mockMvc.perform(as(me, get("/api/v1/gacha/collection").param("owned", "false")))
                .andExpect(jsonPath("$.cards.length()").value(3))
                .andExpect(jsonPath("$.owned").value(1))
                .andExpect(jsonPath("$.total").value(4));
    }

    /** Basic mozzi are given at sign-up: not in the collection or its progress, not exchanged. */
    @Test
    void basicMozziStayOutOfTheGacha() throws Exception {
        gacha.wallet(me, 0, 1_000);
        Long basic = gacha.card("BASIC-01", CardTier.NONE);
        gacha.card("S2-01-01", CardTier.COMMON);
        gacha.owned(me, basic);

        mockMvc.perform(as(me, get("/api/v1/gacha/status")))
                .andExpect(jsonPath("$.collection.owned").value(0))
                .andExpect(jsonPath("$.collection.total").value(1));
        mockMvc.perform(as(me, get("/api/v1/gacha/collection")))
                .andExpect(jsonPath("$.total").value(1))
                .andExpect(jsonPath("$.cards.length()").value(1))
                .andExpect(jsonPath("$.cards[0].code").value("S2-01-01"));
        exchange(me, basic)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CARD_NOT_EXCHANGEABLE"));
    }

    @Test
    void seenClearsTheNewMarkAndIgnoresCardsNotOwned() throws Exception {
        gacha.wallet(me, 1, 0);
        Long card = gacha.card("S2-01-01", CardTier.COMMON);
        Long notMine = gacha.card("S2-01-02", CardTier.COMMON, true);
        draw(me, 1).andExpect(jsonPath("$.results[0].card.isNew").value(true));

        mockMvc.perform(as(me, post("/api/v1/gacha/collection/seen"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"cardIds\": [%d, %d, 999999]}".formatted(card, notMine)))
                .andExpect(status().isNoContent());

        mockMvc.perform(as(me, get("/api/v1/gacha/collection").param("owned", "true")))
                .andExpect(jsonPath("$.cards.length()").value(1))
                .andExpect(jsonPath("$.cards[0].isNew").value(false));
        assertThat(jdbcTemplate.queryForObject("select count(*) from member_card", Integer.class)).isEqualTo(1);
    }

    // ---- draws

    @Test
    void aSecondCopyWithinOneDrawIsADuplicate() throws Exception {
        gacha.wallet(me, 10, 0);
        Long card = gacha.card("S2-01-01", CardTier.COMMON);
        gacha.card("S2-01-02", CardTier.COMMON);
        script.addAll(List.of(ROLL_COMMON, 0, ROLL_COMMON, 0));

        draw(me, 2)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.results.length()").value(2))
                .andExpect(jsonPath("$.results[0].card.cardId").value(card))
                .andExpect(jsonPath("$.results[0].firstAcquired").value(true))
                .andExpect(jsonPath("$.results[0].shardsGained").value(0))
                .andExpect(jsonPath("$.results[1].card.cardId").value(card))
                .andExpect(jsonPath("$.results[1].firstAcquired").value(false))
                .andExpect(jsonPath("$.results[1].shardsGained").value(1))
                .andExpect(jsonPath("$.results[1].card.ownedCount").value(2))
                .andExpect(jsonPath("$.ticketCount").value(8))
                .andExpect(jsonPath("$.shardCount").value(1))
                .andExpect(jsonPath("$.collection.owned").value(1))
                .andExpect(jsonPath("$.collection.total").value(2));

        assertThat(jdbcTemplate.queryForObject(
                "select owned_count from member_card where card_id = ?", Integer.class, card)).isEqualTo(2);
        assertThat(jdbcTemplate.queryForList(
                "select reason || ':' || currency || ':' || amount from wallet_ledger where reason <> 'ADMIN' "
                        + "order by wallet_ledger_id", String.class))
                .containsExactly("DRAW:TICKET:-2", "DUPLICATE:SHARD:1");
        assertThat(jdbcTemplate.queryForList(
                "select tier || ':' || first_acquired || ':' || shards_gained from gacha_draw_result order by seq",
                String.class))
                .containsExactly("COMMON:true:0", "COMMON:false:1");
        assertBalancesMatchLedger(me);
    }

    @Test
    void legendaryComesFromTheCardsNotOwnedYet() throws Exception {
        gacha.wallet(me, 1, 0);
        Long missing = null;
        for (int i = 1; i <= 10; i++) {
            Long card = gacha.card("S2-L-%02d".formatted(i), CardTier.LEGENDARY);
            if (i == 7) {
                missing = card;
            } else {
                gacha.owned(me, card);
            }
        }
        // Index 0 of the narrowed candidates: the one legendary the member lacks.
        script.addAll(List.of(ROLL_LEGENDARY, 0));

        draw(me, 1)
                .andExpect(jsonPath("$.results[0].card.cardId").value(missing))
                .andExpect(jsonPath("$.results[0].firstAcquired").value(true));
    }

    @Test
    void withEveryLegendaryOwnedAnyOfThemComesAgain() throws Exception {
        gacha.wallet(me, 1, 0);
        for (int i = 1; i <= 10; i++) {
            gacha.owned(me, gacha.card("S2-L-%02d".formatted(i), CardTier.LEGENDARY));
        }
        // Index 9 exists only if all ten legendaries are candidates.
        script.addAll(List.of(ROLL_LEGENDARY, 9));

        draw(me, 1)
                .andExpect(jsonPath("$.results[0].card.code").value("S2-L-10"))
                .andExpect(jsonPath("$.results[0].firstAcquired").value(false))
                .andExpect(jsonPath("$.results[0].shardsGained").value(15))
                .andExpect(jsonPath("$.shardCount").value(15));
    }

    @Test
    void drawingMoreThanTheTicketsLeftSpendsNothing() throws Exception {
        gacha.wallet(me, 3, 0);
        gacha.card("S2-01-01", CardTier.COMMON);

        draw(me, 4)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NOT_ENOUGH_TICKETS"));
        assertThat(gacha.tickets(me)).isEqualTo(3);

        draw(me, 3)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.ticketCount").value(0));
        assertBalancesMatchLedger(me);
    }

    @Test
    void countIsOneToTen() throws Exception {
        gacha.wallet(me, 20, 0);
        draw(me, 0).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        draw(me, 11).andExpect(status().isBadRequest()).andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        mockMvc.perform(as(me, post("/api/v1/gacha/draws"))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"count\": 1}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void aResendWithTheSameKeyReplaysTheFirstDraw() throws Exception {
        gacha.wallet(me, 10, 0);
        gacha.card("S2-01-01", CardTier.COMMON);
        String key = UUID.randomUUID().toString();

        JsonNode first = body(draw(me, 1, key).andExpect(status().isCreated()));
        JsonNode second = body(draw(me, 1, key).andExpect(status().isCreated()));

        assertThat(second).isEqualTo(first);
        assertThat(gacha.tickets(me)).isEqualTo(9);
        assertThat(jdbcTemplate.queryForObject("select count(*) from gacha_draw", Integer.class)).isEqualTo(1);

        draw(me, 2, key)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("IDEMPOTENCY_CONFLICT"));
    }

    /** A refused request stores nothing under its key, so a retry with that key runs again. */
    @Test
    void aRefusedDrawLeavesItsKeyFree() throws Exception {
        gacha.wallet(me, 0, 0);
        gacha.card("S2-01-01", CardTier.COMMON);
        String key = UUID.randomUUID().toString();
        draw(me, 1, key).andExpect(status().isConflict());

        jdbcTemplate.update("update member_wallet set ticket_balance = 1 where member_id = ?", me);
        draw(me, 1, key).andExpect(status().isCreated());
    }

    @Test
    void aTierWithoutCardsRefusesTheWholeDraw() throws Exception {
        gacha.wallet(me, 10, 0);
        gacha.card("S2-01-01", CardTier.COMMON);
        script.addAll(List.of(ROLL_COMMON, 0, ROLL_EPIC));

        draw(me, 2)
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("GACHA_UNAVAILABLE"));
        assertThat(gacha.tickets(me)).isEqualTo(10);
        assertThat(jdbcTemplate.queryForObject("select count(*) from member_card", Integer.class)).isZero();
        assertThat(jdbcTemplate.queryForObject("select count(*) from gacha_draw", Integer.class)).isZero();
    }

    // ---- exchanges

    @Test
    void exchangeIsForLegendaryAndMythicCardsNotOwned() throws Exception {
        gacha.wallet(me, 0, 600);
        Long epic = gacha.card("S2-01-01", CardTier.EPIC);
        Long ownedLegendary = gacha.card("S2-02-01", CardTier.LEGENDARY);
        Long legendary = gacha.card("S2-02-02", CardTier.LEGENDARY);
        Long mythic = gacha.card("S2-03-01", CardTier.MYTHIC);
        Long retired = gacha.card("S2-03-02", CardTier.MYTHIC, false);
        gacha.owned(me, ownedLegendary);

        exchange(me, epic).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CARD_NOT_EXCHANGEABLE"));
        exchange(me, ownedLegendary).andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("CARD_ALREADY_OWNED"));
        exchange(me, retired).andExpect(status().isNotFound());
        exchange(me, 999_999L).andExpect(status().isNotFound());

        exchange(me, legendary)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.card.cardId").value(legendary))
                .andExpect(jsonPath("$.card.owned").value(true))
                .andExpect(jsonPath("$.card.isNew").value(true))
                .andExpect(jsonPath("$.shardsSpent").value(200))
                .andExpect(jsonPath("$.shardCount").value(400));
        exchange(me, mythic)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.shardsSpent").value(400))
                .andExpect(jsonPath("$.shardCount").value(0));

        assertThat(jdbcTemplate.queryForList(
                "select ref_id || ':' || amount from wallet_ledger where reason = 'EXCHANGE' order by wallet_ledger_id",
                String.class))
                .containsExactly(legendary + ":-200", mythic + ":-400");
        assertBalancesMatchLedger(me);
    }

    @Test
    void exchangeNeedsEnoughShards() throws Exception {
        gacha.wallet(me, 0, 199);
        Long legendary = gacha.card("S2-02-01", CardTier.LEGENDARY);

        exchange(me, legendary)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NOT_ENOUGH_SHARDS"));
        assertThat(gacha.shards(me)).isEqualTo(199);
        mockMvc.perform(as(me, post("/api/v1/gacha/exchanges"))
                        .header(IdempotencyStore.HEADER, UUID.randomUUID().toString())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
    }

    // ---- rewards and withdrawal

    @Test
    void dailyLoginPaysOncePerDay() throws Exception {
        gacha.wallet(me, 20, 0);
        LocalDate today = LocalDate.now(clock);

        mockMvc.perform(as(me, post("/api/v1/rewards/daily-login")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.date").value(today.toString()))
                .andExpect(jsonPath("$.granted").value(true))
                .andExpect(jsonPath("$.tickets").value(5))
                .andExpect(jsonPath("$.ticketCount").value(25));
        mockMvc.perform(as(me, post("/api/v1/rewards/daily-login")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.granted").value(false))
                .andExpect(jsonPath("$.tickets").value(0))
                .andExpect(jsonPath("$.ticketCount").value(25));

        assertThat(jdbcTemplate.queryForList(
                "select reward_key from wallet_ledger where reason = 'DAILY_LOGIN'", String.class))
                .containsExactly("LOGIN:" + today);
        assertBalancesMatchLedger(me);
    }

    @Test
    void eachCareActivityPaysOncePerDay() throws Exception {
        gacha.wallet(me, 20, 0);
        LocalDate today = LocalDate.now(clock);

        care(me, "PET").andExpect(status().isOk())
                .andExpect(jsonPath("$.date").value(today.toString()))
                .andExpect(jsonPath("$.action").value("PET"))
                .andExpect(jsonPath("$.type").value("CARE_PET"))
                .andExpect(jsonPath("$.granted").value(true))
                .andExpect(jsonPath("$.tickets").value(2))
                .andExpect(jsonPath("$.ticketCount").value(22));
        care(me, "PLAY").andExpect(status().isOk())
                .andExpect(jsonPath("$.tickets").value(2))
                .andExpect(jsonPath("$.ticketCount").value(24));
        care(me, "PET").andExpect(status().isOk())
                .andExpect(jsonPath("$.granted").value(false))
                .andExpect(jsonPath("$.tickets").value(0))
                .andExpect(jsonPath("$.ticketCount").value(24));
        care(me, "FEED").andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("CARE_FEED"))
                .andExpect(jsonPath("$.ticketCount").value(26));

        assertThat(jdbcTemplate.queryForList(
                "select reward_key from wallet_ledger where reason = 'CARE' order by reward_key", String.class))
                .containsExactly("CARE_FEED:" + today, "CARE_PET:" + today, "CARE_PLAY:" + today);
        assertBalancesMatchLedger(me);
    }

    @Test
    void careRewardNeedsAKnownActivity() throws Exception {
        gacha.wallet(me, 20, 0);
        for (String body : List.of("{}", "{\"action\": \"DANCE\"}")) {
            mockMvc.perform(as(me, post("/api/v1/rewards/care"))
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(body))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
        }
        assertThat(gacha.tickets(me)).isEqualTo(20);
    }

    @Test
    void withdrawalDeletesEveryGachaRow() throws Exception {
        gacha.wallet(me, 10, 0);
        gacha.card("S2-01-01", CardTier.COMMON);
        draw(me, 3).andExpect(status().isCreated());

        mockMvc.perform(as(me, delete("/api/v1/members/me"))).andExpect(status().isNoContent());

        for (String table : List.of("gacha_draw_result", "gacha_draw", "member_card", "wallet_ledger", "member_wallet")) {
            assertThat(jdbcTemplate.queryForObject("select count(*) from " + table, Integer.class))
                    .as(table).isZero();
        }
    }

    private ResultActions draw(Long memberId, int count) throws Exception {
        return draw(memberId, count, UUID.randomUUID().toString());
    }

    private ResultActions draw(Long memberId, int count, String key) throws Exception {
        return mockMvc.perform(as(memberId, post("/api/v1/gacha/draws"))
                .header(IdempotencyStore.HEADER, key)
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"count\": %d}".formatted(count)));
    }

    private ResultActions care(Long memberId, String action) throws Exception {
        return mockMvc.perform(as(memberId, post("/api/v1/rewards/care"))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"action\": \"%s\"}".formatted(action)));
    }

    private ResultActions exchange(Long memberId, Long cardId) throws Exception {
        return mockMvc.perform(as(memberId, post("/api/v1/gacha/exchanges"))
                .header(IdempotencyStore.HEADER, UUID.randomUUID().toString())
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"cardId\": %d}".formatted(cardId)));
    }

    private void assertBalancesMatchLedger(Long memberId) {
        assertThat(gacha.tickets(memberId)).isEqualTo(gacha.ledgerSum(memberId, "TICKET"));
        assertThat(gacha.shards(memberId)).isEqualTo(gacha.ledgerSum(memberId, "SHARD"));
    }

    private MockHttpServletRequestBuilder as(Long memberId, MockHttpServletRequestBuilder request) {
        String token = accessTokens.computeIfAbsent(memberId,
                id -> transactionTemplate.execute(status -> sessionService.start(id)).accessToken());
        return request.header(HttpHeaders.AUTHORIZATION, "Bearer " + token);
    }

    private JsonNode body(ResultActions result) throws Exception {
        return objectMapper.readTree(result.andReturn().getResponse().getContentAsString());
    }

}
