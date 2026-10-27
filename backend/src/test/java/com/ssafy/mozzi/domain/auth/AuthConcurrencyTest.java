package com.ssafy.mozzi.domain.auth;

import static com.ssafy.mozzi.domain.auth.AuthTestSupport.googleAccepts;
import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

import com.ssafy.mozzi.domain.auth.dto.GoogleLoginResponseDto;
import com.ssafy.mozzi.domain.auth.service.AuthService;
import com.ssafy.mozzi.domain.auth.service.IssuedTokens;
import com.ssafy.mozzi.domain.member.entity.TermsType;
import com.ssafy.mozzi.domain.member.service.TermsAgreementCommand;
import com.ssafy.mozzi.global.exception.BusinessException;
import com.ssafy.mozzi.global.security.AuthenticatedMember;
import com.ssafy.mozzi.integration.google.GoogleIdTokenVerifier;
import com.ssafy.mozzi.support.IntegrationTest;

/**
 * Races that only a real database can settle: the conditional refresh update, the member
 * row lock and the partial unique indexes. Each case starts its calls together on separate
 * threads, so each runs in its own transaction.
 */
@IntegrationTest
class AuthConcurrencyTest {

    private static final int THREADS = 4;

    private static final List<TermsAgreementCommand> AGREEMENTS = List.of(
            new TermsAgreementCommand(TermsType.TERMS, "1.0"),
            new TermsAgreementCommand(TermsType.PRIVACY, "1.0"));

    @Autowired
    private AuthService authService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @MockitoBean
    private GoogleIdTokenVerifier googleIdTokenVerifier;

    private ExecutorService executor;

    @BeforeEach
    void setUp() {
        AuthTestSupport.clearAuthTables(jdbcTemplate);
        executor = Executors.newFixedThreadPool(THREADS);
    }

    @AfterEach
    void tearDown() {
        executor.shutdownNow();
    }

    @Test
    void sameRefreshTokenUsedConcurrentlySucceedsOnce() throws Exception {
        IssuedTokens login = signUp("id-a", "sub-a", "하루");

        List<Outcome> outcomes = race(() -> authService.refresh(login.refreshToken()));

        assertThat(outcomes).filteredOn(Outcome::succeeded).hasSize(1);
        assertThat(outcomes).filteredOn(o -> !o.succeeded())
                .allMatch(o -> "REFRESH_TOKEN_INVALID".equals(o.errorCode()));
        // The losers must not have damaged the winner's session.
        String winnersRefresh = outcomes.stream().filter(Outcome::succeeded).findFirst().orElseThrow()
                .tokens().refreshToken();
        assertThat(authService.refresh(winnersRefresh).refreshToken()).isNotBlank();
    }

    @Test
    void concurrentLoginsLeaveExactlyOneSession() throws Exception {
        signUp("id-a", "sub-a", "하루");

        List<Outcome> outcomes = race(() -> {
            GoogleLoginResponseDto response = authService.loginWithGoogle("id-a");
            GoogleLoginResponseDto.LoginSuccess success = (GoogleLoginResponseDto.LoginSuccess) response;
            return new IssuedTokens(success.accessToken(), success.accessExpiresAt(),
                    success.refreshToken(), success.refreshExpiresAt());
        });

        assertThat(outcomes).allMatch(Outcome::succeeded);
        assertThat(jdbcTemplate.queryForObject("select count(*) from member_session", Integer.class)).isEqualTo(1);
        // Only the last login's refresh token is still valid.
        long stillValid = outcomes.stream()
                .filter(o -> attempt(() -> authService.refresh(o.tokens().refreshToken())).succeeded())
                .count();
        assertThat(stillValid).isEqualTo(1);
    }

    /** Different tickets, same nickname: the unique index lets exactly one through. */
    @Test
    void concurrentSignupsForTheSameNicknameCreateOneMember() throws Exception {
        List<String> tickets = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            tickets.add(signupTicket("id-" + i, "sub-" + i));
        }

        List<Outcome> outcomes = raceEach(tickets, ticket -> authService.signUp(ticket, "하루", AGREEMENTS));

        assertThat(outcomes).filteredOn(Outcome::succeeded).hasSize(1);
        assertThat(outcomes).filteredOn(o -> !o.succeeded())
                .allMatch(o -> "NICKNAME_DUPLICATED".equals(o.errorCode()));
        assertThat(jdbcTemplate.queryForObject("select count(*) from member", Integer.class)).isEqualTo(1);
        // The losers kept their tickets.
        assertThat(jdbcTemplate.queryForObject("select count(*) from signup_ticket", Integer.class))
                .isEqualTo(THREADS - 1);
    }

    /** Several tickets for one Google account: one account, the rest told to log in. */
    @Test
    void concurrentSignupsForTheSameGoogleAccountCreateOneMember() throws Exception {
        List<String> tickets = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            tickets.add(signupTicket("id-a", "sub-a"));
        }
        List<String> nicknames = List.of("하루", "이틀", "사흘", "나흘");

        List<Outcome> outcomes = raceEach(tickets,
                ticket -> authService.signUp(ticket, nicknames.get(tickets.indexOf(ticket)), AGREEMENTS));

        assertThat(outcomes).filteredOn(Outcome::succeeded).hasSize(1);
        assertThat(outcomes).filteredOn(o -> !o.succeeded())
                .allMatch(o -> "ACCOUNT_ALREADY_REGISTERED".equals(o.errorCode()));
    }

    /** A logout from a session that was already replaced must not end the new one. */
    @Test
    void lateLogoutOfAReplacedSessionLeavesTheNewOneAlone() throws Exception {
        signUp("id-a", "sub-a", "하루");
        Long memberId = jdbcTemplate.queryForObject("select member_id from member", Long.class);
        UUID oldSession = jdbcTemplate.queryForObject("select session_id from member_session", UUID.class);
        authService.loginWithGoogle("id-a");

        authService.logout(new AuthenticatedMember(memberId, oldSession));

        assertThat(jdbcTemplate.queryForObject("select count(*) from member_session", Integer.class)).isEqualTo(1);
    }

    private IssuedTokens signUp(String idToken, String subject, String nickname) {
        return authService.signUp(signupTicket(idToken, subject), nickname, AGREEMENTS);
    }

    private String signupTicket(String idToken, String subject) {
        googleAccepts(googleIdTokenVerifier, idToken, subject, subject + "@gmail.com");
        return ((GoogleLoginResponseDto.SignupRequired) authService.loginWithGoogle(idToken)).signupToken();
    }

    private List<Outcome> race(Callable<IssuedTokens> call) throws Exception {
        List<Callable<IssuedTokens>> calls = new ArrayList<>();
        for (int i = 0; i < THREADS; i++) {
            calls.add(call);
        }
        return start(calls);
    }

    private <T> List<Outcome> raceEach(List<T> inputs, java.util.function.Function<T, IssuedTokens> call)
            throws Exception {
        return start(inputs.stream().<Callable<IssuedTokens>>map(input -> () -> call.apply(input)).toList());
    }

    /** Releases every call at once, so they really overlap. */
    private List<Outcome> start(List<Callable<IssuedTokens>> calls) throws Exception {
        CountDownLatch ready = new CountDownLatch(calls.size());
        CountDownLatch go = new CountDownLatch(1);
        List<Future<Outcome>> futures = new ArrayList<>();
        for (Callable<IssuedTokens> call : calls) {
            futures.add(executor.submit(() -> {
                ready.countDown();
                go.await();
                return attempt(call);
            }));
        }
        ready.await(5, TimeUnit.SECONDS);
        go.countDown();
        List<Outcome> outcomes = new ArrayList<>();
        for (Future<Outcome> future : futures) {
            outcomes.add(future.get(30, TimeUnit.SECONDS));
        }
        return outcomes;
    }

    private static Outcome attempt(Callable<IssuedTokens> call) {
        try {
            return new Outcome(call.call(), null);
        } catch (BusinessException e) {
            return new Outcome(null, e.errorCode().code());
        } catch (Exception e) {
            return new Outcome(null, e.getClass().getSimpleName());
        }
    }

    private record Outcome(IssuedTokens tokens, String errorCode) {

        boolean succeeded() {
            return tokens != null;
        }

    }

}
