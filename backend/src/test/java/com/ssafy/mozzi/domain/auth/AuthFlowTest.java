package com.ssafy.mozzi.domain.auth;

import static com.ssafy.mozzi.domain.auth.AuthTestSupport.SIGNUP_BODY;
import static com.ssafy.mozzi.domain.auth.AuthTestSupport.googleAccepts;
import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.BDDMockito.given;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;

import org.assertj.core.data.TemporalUnitWithinOffset;
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

import com.jayway.jsonpath.JsonPath;
import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.gacha.entity.CardTier;
import com.ssafy.mozzi.domain.icon.entity.DefaultMyIcons;
import com.ssafy.mozzi.integration.google.GoogleIdTokenInvalidException;
import com.ssafy.mozzi.integration.google.GoogleIdTokenVerifier;
import com.ssafy.mozzi.integration.google.GoogleUnavailableException;
import com.ssafy.mozzi.support.GachaFixtures;
import com.ssafy.mozzi.support.IntegrationTest;

/**
 * The login, sign-up, refresh, logout and withdrawal flows end to end, through the real
 * filter and database. Only Google is replaced.
 */
@IntegrationTest
@AutoConfigureMockMvc
class AuthFlowTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private GoogleIdTokenVerifier googleIdTokenVerifier;

    @BeforeEach
    void reset() {
        AuthTestSupport.clearAuthTables(jdbcTemplate);
    }

    @Test
    void newUserGetsASignupTicketAndNoMemberYet() throws Exception {
        googleAccepts(googleIdTokenVerifier, "id-a", "sub-a", "a@gmail.com");

        googleLogin("id-a")
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.status").value("SIGNUP_REQUIRED"))
                .andExpect(jsonPath("$.signupToken").isString())
                .andExpect(jsonPath("$.signupExpiresAt").isString());

        assertThat(count("member")).isZero();
        assertThat(count("signup_ticket")).isEqualTo(1);
    }

    @Test
    void signupCreatesTheMemberWithTermsAndSessionAndUsesUpTheTicket() throws Exception {
        String ticket = signupTicket("id-a", "sub-a", "a@gmail.com");

        String body = signUp(ticket, "하루")
                .andExpect(status().isCreated())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andExpect(jsonPath("$.accessToken").isString())
                .andExpect(jsonPath("$.refreshToken").isString())
                .andReturn().getResponse().getContentAsString();

        mockMvc.perform(get("/api/v1/members/me").header(HttpHeaders.AUTHORIZATION, bearer(body)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("a@gmail.com"))
                .andExpect(jsonPath("$.nickname").value("하루"))
                .andExpect(jsonPath("$.provider").value("GOOGLE"));
        assertThat(count("terms_agreement")).isEqualTo(2);
        assertThat(count("member_session")).isEqualTo(1);
        assertThat(count("signup_ticket")).isZero();
        // The sign-up reward: a wallet with 20 tickets, and the ledger row that paid them.
        assertThat(jdbcTemplate.queryForObject("select ticket_balance from member_wallet", Integer.class))
                .isEqualTo(20);
        assertThat(jdbcTemplate.queryForObject(
                "select reason || ':' || amount || ':' || reward_key from wallet_ledger", String.class))
                .isEqualTo("SIGNUP:20:SIGNUP");

        signUp(ticket, "다른닉네임")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SIGNUP_TOKEN_INVALID"));
    }

    /** A new member owns the basic mozzi, each picked for its emotion. */
    @Test
    void signupGivesTheBasicMozzi() throws Exception {
        GachaFixtures gacha = new GachaFixtures(jdbcTemplate);
        gacha.reset();
        try {
            Long happy = gacha.card("BASIC-01", CardTier.NONE, Emotion.HAPPY, true);
            Long calm = gacha.card("BASIC-02", CardTier.NONE, Emotion.CALM, true);
            gacha.card("S1-01-01", CardTier.MYTHIC, Emotion.HAPPY, true);

            signUpAs("id-a", "sub-a", "a@gmail.com", "하루");

            assertThat(jdbcTemplate.queryForList("select card_id from member_card order by card_id", Long.class))
                    .containsExactly(happy, calm);
            assertThat(jdbcTemplate.queryForList(
                    "select emotion || ':' || card_id from my_mozzi_emoticon order by emotion", String.class))
                    .containsExactly("CALM:" + calm, "HAPPY:" + happy);
        } finally {
            gacha.reset();
        }
    }

    /** A new member starts with the default icons, in list order. */
    @Test
    void signupGivesTheDefaultIcons() throws Exception {
        signUpAs("id-a", "sub-a", "a@gmail.com", "하루");

        assertThat(jdbcTemplate.queryForList(
                "select category || ':' || name from my_icon where deleted_at is null order by my_icon_id",
                String.class))
                .containsExactlyElementsOf(DefaultMyIcons.ALL.stream()
                        .map(icon -> icon.category() + ":" + icon.name())
                        .toList());
    }

    @Test
    void existingMemberLogsInWithoutANickname() throws Exception {
        signUpAs("id-a", "sub-a", "a@gmail.com", "하루");

        googleLogin("id-a")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("LOGIN_SUCCESS"))
                .andExpect(jsonPath("$.accessToken").isString())
                .andExpect(jsonPath("$.refreshToken").isString());
        assertThat(count("signup_ticket")).isZero();
    }

    /** Single login: a new login signs the previous device out on its next request. */
    @Test
    void newLoginRevokesThePreviousSession() throws Exception {
        String first = signUpAs("id-a", "sub-a", "a@gmail.com", "하루");

        String second = googleLogin("id-a").andReturn().getResponse().getContentAsString();

        mockMvc.perform(get("/api/v1/members/me").header(HttpHeaders.AUTHORIZATION, bearer(first)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REVOKED"));
        refresh(refreshToken(first))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("REFRESH_TOKEN_INVALID"));
        mockMvc.perform(get("/api/v1/members/me").header(HttpHeaders.AUTHORIZATION, bearer(second)))
                .andExpect(status().isOk());
        assertThat(count("member_session")).isEqualTo(1);
    }

    @Test
    void refreshRotatesTheTokenKeepsTheSessionAndExtendsIt() throws Exception {
        String login = signUpAs("id-a", "sub-a", "a@gmail.com", "하루");
        String sessionId = jdbcTemplate.queryForObject("select session_id::text from member_session", String.class);
        jdbcTemplate.update("update member_session set refresh_expires_at = now() + interval '1 day'");

        String rotated = refresh(refreshToken(login))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, "no-store"))
                .andReturn().getResponse().getContentAsString();

        assertThat(refreshToken(rotated)).isNotEqualTo(refreshToken(login)).startsWith(sessionId + ".");
        OffsetDateTime expiresAt = OffsetDateTime.parse(JsonPath.read(rotated, "$.refreshExpiresAt"));
        assertThat(expiresAt.toInstant()).isCloseTo(
                Instant.now().plus(Duration.ofDays(30)),
                new TemporalUnitWithinOffset(1, ChronoUnit.MINUTES));
        mockMvc.perform(get("/api/v1/members/me").header(HttpHeaders.AUTHORIZATION, bearer(rotated)))
                .andExpect(status().isOk());

        // The token just used is no longer current.
        refresh(refreshToken(login))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("REFRESH_TOKEN_INVALID"));
        // The access token issued before the refresh still belongs to the same session.
        mockMvc.perform(get("/api/v1/members/me").header(HttpHeaders.AUTHORIZATION, bearer(login)))
                .andExpect(status().isOk());
    }

    @Test
    void expiredRefreshTokenIsRejectedAndEndsTheSession() throws Exception {
        String login = signUpAs("id-a", "sub-a", "a@gmail.com", "하루");
        jdbcTemplate.update("update member_session set refresh_expires_at = now() - interval '1 second'");

        refresh(refreshToken(login))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("REFRESH_TOKEN_EXPIRED"));
        mockMvc.perform(get("/api/v1/members/me").header(HttpHeaders.AUTHORIZATION, bearer(login)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SESSION_REVOKED"));
    }

    @Test
    void malformedRefreshTokenIsInvalid() throws Exception {
        refresh("not-a-refresh-token")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("REFRESH_TOKEN_INVALID"));
        refresh("00000000-0000-0000-0000-000000000000.secret")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("REFRESH_TOKEN_INVALID"));
    }

    @Test
    void expiredSignupTicketIsRejected() throws Exception {
        String ticket = signupTicket("id-a", "sub-a", "a@gmail.com");
        jdbcTemplate.update("update signup_ticket set expires_at = now() - interval '1 second'");

        signUp(ticket, "하루")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("SIGNUP_TOKEN_EXPIRED"));
        assertThat(count("member")).isZero();
    }

    /** A rejected nickname leaves the ticket usable, so the user can just pick another. */
    @Test
    void duplicateNicknameIgnoringCaseKeepsTheTicket() throws Exception {
        signUpAs("id-a", "sub-a", "a@gmail.com", "Alice");
        String ticket = signupTicket("id-b", "sub-b", "b@gmail.com");

        signUp(ticket, "alice")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("NICKNAME_DUPLICATED"));
        signUp(ticket, "Bob").andExpect(status().isCreated());
    }

    @Test
    void nicknameOutsideTheRulesIsInvalidInputAndKeepsTheTicket() throws Exception {
        String ticket = signupTicket("id-a", "sub-a", "a@gmail.com");

        signUp(ticket, "하 루")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("nickname"));
        signUp(ticket, "가나다라마바사아자차카타파").andExpect(status().isBadRequest());
        signUp(ticket, "하루").andExpect(status().isCreated());
    }

    @Test
    void signupWithoutTheCurrentTermsIsRefused() throws Exception {
        String ticket = signupTicket("id-a", "sub-a", "a@gmail.com");
        String onlyTerms = """
                {"signupToken": "%s", "nickname": "하루", "agreedTerms": [{"type": "TERMS", "version": "1.0"}]}
                """.formatted(ticket);
        String oldVersion = """
                {"signupToken": "%s", "nickname": "하루",
                 "agreedTerms": [{"type": "TERMS", "version": "0.9"}, {"type": "PRIVACY", "version": "1.0"}]}
                """.formatted(ticket);

        postJson("/api/v1/auth/signup", onlyTerms)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TERMS_AGREEMENT_REQUIRED"));
        postJson("/api/v1/auth/signup", oldVersion)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("TERMS_AGREEMENT_REQUIRED"));
        assertThat(count("member")).isZero();
    }

    /** A leftover ticket must not create a second account, nor log in. */
    @Test
    void leftoverTicketForAnExistingAccountIsRefused() throws Exception {
        String first = signupTicket("id-a", "sub-a", "a@gmail.com");
        String second = signupTicket("id-a", "sub-a", "a@gmail.com");
        signUp(first, "하루").andExpect(status().isCreated());
        String sessionBefore = jdbcTemplate.queryForObject("select session_id::text from member_session", String.class);

        signUp(second, "모찌")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("ACCOUNT_ALREADY_REGISTERED"));
        assertThat(jdbcTemplate.queryForObject("select session_id::text from member_session", String.class))
                .isEqualTo(sessionBefore);
    }

    /** Accounts are identified by sub; the same email under another sub is another person. */
    @Test
    void sameEmailWithAnotherGoogleAccountIsNotMerged() throws Exception {
        signUpAs("id-a", "sub-a", "same@gmail.com", "하루");
        googleAccepts(googleIdTokenVerifier, "id-b", "sub-b", "same@gmail.com");

        googleLogin("id-b").andExpect(jsonPath("$.status").value("SIGNUP_REQUIRED"));
    }

    @Test
    void googleAccountWithoutAVerifiedEmailCannotSignUp() throws Exception {
        googleAccepts(googleIdTokenVerifier, "id-a", "sub-a", null);

        googleLogin("id-a")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("GOOGLE_EMAIL_UNAVAILABLE"));
        assertThat(count("signup_ticket")).isZero();
    }

    @Test
    void invalidGoogleTokenAndGoogleOutageAreToldApart() throws Exception {
        given(googleIdTokenVerifier.verify("bad")).willThrow(new GoogleIdTokenInvalidException("bad", null));
        given(googleIdTokenVerifier.verify("down")).willThrow(new GoogleUnavailableException(null));

        googleLogin("bad")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("GOOGLE_TOKEN_INVALID"));
        googleLogin("down")
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.code").value("AUTH_SERVICE_UNAVAILABLE"));
    }

    @Test
    void logoutEndsTheSession() throws Exception {
        String login = signUpAs("id-a", "sub-a", "a@gmail.com", "하루");

        mockMvc.perform(post("/api/v1/auth/logout").header(HttpHeaders.AUTHORIZATION, bearer(login)))
                .andExpect(status().isNoContent());

        assertThat(count("member_session")).isZero();
        refresh(refreshToken(login)).andExpect(status().isUnauthorized());
    }

    @Test
    void withdrawalEndsTheSessionAndAllowsAnImmediateFreshSignup() throws Exception {
        String login = signUpAs("id-a", "sub-a", "a@gmail.com", "하루");
        Long firstId = jdbcTemplate.queryForObject("select member_id from member", Long.class);

        mockMvc.perform(delete("/api/v1/members/me").header(HttpHeaders.AUTHORIZATION, bearer(login)))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/v1/members/me").header(HttpHeaders.AUTHORIZATION, bearer(login)))
                .andExpect(status().isUnauthorized());

        String ticket = JsonPath.read(googleLogin("id-a")
                .andExpect(jsonPath("$.status").value("SIGNUP_REQUIRED"))
                .andReturn().getResponse().getContentAsString(), "$.signupToken");
        // The withdrawn member's nickname is free again.
        signUp(ticket, "하루").andExpect(status().isCreated());
        Long secondId = jdbcTemplate.queryForObject(
                "select member_id from member where deleted_at is null", Long.class);
        assertThat(secondId).isNotEqualTo(firstId);
    }

    @Test
    void protectedEndpointsNeedAToken() throws Exception {
        mockMvc.perform(get("/api/v1/members/me"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("ACCESS_TOKEN_MISSING"))
                .andExpect(jsonPath("$.traceId").isString());
        // The auth paths are public one by one, not as a prefix.
        mockMvc.perform(post("/api/v1/auth/logout"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/auth/google"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/v1/auth/google/").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/v1/members/me").header(HttpHeaders.AUTHORIZATION, "Bearer garbage"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("ACCESS_TOKEN_INVALID"));
        mockMvc.perform(get("/actuator/health/readiness")).andExpect(status().isOk());
    }

    private String signUpAs(String idToken, String subject, String email, String nickname) throws Exception {
        String ticket = signupTicket(idToken, subject, email);
        return signUp(ticket, nickname)
                .andExpect(status().isCreated())
                .andReturn().getResponse().getContentAsString();
    }

    private String signupTicket(String idToken, String subject, String email) throws Exception {
        googleAccepts(googleIdTokenVerifier, idToken, subject, email);
        return JsonPath.read(googleLogin(idToken).andReturn().getResponse().getContentAsString(), "$.signupToken");
    }

    private ResultActions googleLogin(String idToken) throws Exception {
        return postJson("/api/v1/auth/google", "{\"idToken\": \"" + idToken + "\"}");
    }

    private ResultActions signUp(String ticket, String nickname) throws Exception {
        return postJson("/api/v1/auth/signup", SIGNUP_BODY.formatted(ticket, nickname));
    }

    private ResultActions refresh(String refreshToken) throws Exception {
        return postJson("/api/v1/auth/refresh", "{\"refreshToken\": \"" + refreshToken + "\"}");
    }

    private ResultActions postJson(String path, String body) throws Exception {
        return mockMvc.perform(post(path).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private int count(String table) {
        return jdbcTemplate.queryForObject("select count(*) from " + table, Integer.class);
    }

    private static String bearer(String tokenResponse) {
        return "Bearer " + JsonPath.read(tokenResponse, "$.accessToken");
    }

    private static String refreshToken(String tokenResponse) {
        return JsonPath.read(tokenResponse, "$.refreshToken");
    }

}
