package com.ssafy.mozzi.domain.gacha.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.fail;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Supplier;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.mozzi.domain.gacha.dto.GachaDrawRequestDto;
import com.ssafy.mozzi.domain.gacha.dto.GachaDrawResponseDto;
import com.ssafy.mozzi.domain.gacha.entity.CardTier;
import com.ssafy.mozzi.domain.gacha.entity.MemberCard;
import com.ssafy.mozzi.domain.gacha.exception.GachaErrorCode;
import com.ssafy.mozzi.domain.gacha.repository.MemberCardRepository;
import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.domain.member.service.MemberService;
import com.ssafy.mozzi.global.exception.BusinessException;
import com.ssafy.mozzi.global.exception.ErrorCode;
import com.ssafy.mozzi.global.security.SecurityErrorCode;
import com.ssafy.mozzi.support.DiaryFixtures;
import com.ssafy.mozzi.support.GachaFixtures;
import com.ssafy.mozzi.support.IntegrationTest;

/**
 * One member's requests overlapping in time.
 *
 * <p>Each race holds a first request open in its transaction, part-way through, and sends
 * the second meanwhile. PostgreSQL must report the second blocked by the first's backend
 * ({@code pg_blocking_pids}), and only then is the first let go; so a missing lock fails the
 * test instead of passing because the second merely started late.
 */
@IntegrationTest
class GachaConcurrencyTest {

    @Autowired
    private GachaService gachaService;

    @Autowired
    private GachaQueryService queryService;

    @Autowired
    private MemberService memberService;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private MemberCardRepository memberCardRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PlatformTransactionManager transactionManager;

    /** Each test's own threads, so a request never queues behind unrelated work in a shared pool. */
    private ExecutorService executor;
    private GachaFixtures gacha;
    private Long memberId;

    @BeforeEach
    void setUp() {
        executor = Executors.newFixedThreadPool(2);
        new DiaryFixtures(jdbcTemplate).reset();
        gacha = new GachaFixtures(jdbcTemplate);
        gacha.reset();
        for (CardTier tier : CardTier.values()) {
            gacha.card("S2-" + tier.ordinal() + "-01", tier);
        }
        memberId = memberRepository.saveAndFlush(
                Member.signUp("me@gmail.com", AuthProvider.GOOGLE, "me", "me")).getId();
    }

    /** Lets a second request still running after a failed check finish before the next test truncates. */
    @AfterEach
    void tearDown() throws InterruptedException {
        executor.shutdown();
        assertThat(executor.awaitTermination(15, TimeUnit.SECONDS)).as("requests left running").isTrue();
    }

    @Test
    void aSecondDrawForTheLastTicketWaitsAndIsRefused() throws Exception {
        gacha.wallet(memberId, 1, 0);

        Race<GachaDrawResponseDto, GachaDrawResponseDto> race = race(
                () -> draw(UUID.randomUUID().toString(), 1), false,
                () -> draw(UUID.randomUUID().toString(), 1));

        assertRejectedWith(race.second(), GachaErrorCode.NOT_ENOUGH_TICKETS);
        assertThat(gacha.tickets(memberId)).isZero();
        assertThat(gacha.ledgerSum(memberId, "TICKET")).isZero();
    }

    @Test
    void aResendWaitsForTheFirstDrawAndReplaysIt() throws Exception {
        gacha.wallet(memberId, 10, 0);
        String key = UUID.randomUUID().toString();

        Race<GachaDrawResponseDto, GachaDrawResponseDto> race = race(
                () -> draw(key, 10), false,
                () -> draw(key, 10));

        assertThat(race.second().get(5, TimeUnit.SECONDS)).isEqualTo(race.first());
        assertThat(gacha.tickets(memberId)).isZero();
        assertThat(jdbcTemplate.queryForObject("select count(*) from gacha_draw", Integer.class)).isEqualTo(1);
    }

    /** The first request's record goes with its rollback, so the resend does the work itself. */
    @Test
    void aResendAfterTheFirstDrawRolledBackDrawsAnew() throws Exception {
        gacha.wallet(memberId, 10, 0);
        String key = UUID.randomUUID().toString();

        Race<GachaDrawResponseDto, GachaDrawResponseDto> race = race(
                () -> draw(key, 1), true,
                () -> draw(key, 1));

        GachaDrawResponseDto second = race.second().get(5, TimeUnit.SECONDS);
        assertThat(second.drawId()).isNotEqualTo(race.first().drawId());
        assertThat(gacha.tickets(memberId)).isEqualTo(9);
        assertThat(jdbcTemplate.queryForObject("select count(*) from gacha_draw", Integer.class)).isEqualTo(1);
    }

    /**
     * A draw that passed authentication before the member withdrew waits for the withdrawal's
     * wallet lock, then finds the wallet gone: the ended session, not a server error.
     */
    @Test
    void aDrawRacingWithdrawalEndsAsARevokedSession() throws Exception {
        gacha.wallet(memberId, 10, 0);

        Race<Void, GachaDrawResponseDto> race = race(
                () -> {
                    memberService.withdraw(memberId);
                    return null;
                }, false,
                () -> draw(UUID.randomUUID().toString(), 1));

        assertRejectedWith(race.second(), SecurityErrorCode.SESSION_REVOKED);
        assertThat(jdbcTemplate.queryForObject("select count(*) from gacha_draw", Integer.class)).isZero();
        assertThat(jdbcTemplate.queryForObject("select count(*) from member_wallet", Integer.class)).isZero();
    }

    /**
     * A draw reads the member's cards, the member marks one seen and that commits, then the
     * draw takes another copy of it. The draw's update must not write back the {@code seen_at}
     * it read before.
     */
    @Test
    void aDuplicateDrawnAfterTheCardWasSeenKeepsItSeen() throws Exception {
        Long cardId = gacha.card("S2-9-01", CardTier.COMMON);
        jdbcTemplate.update("""
                insert into member_card (member_id, card_id, owned_count, first_acquired_at)
                values (?, ?, 1, now())
                """, memberId, cardId);

        new TransactionTemplate(transactionManager).executeWithoutResult(status -> {
            MemberCard copy = memberCardRepository.findByMemberId(memberId).stream()
                    .filter(card -> card.getCardId().equals(cardId)).findFirst().orElseThrow();
            assertThat(copy.isNew()).isTrue();

            CompletableFuture.runAsync(() -> queryService.markSeen(memberId, List.of(cardId)), executor).join();

            copy.acquireAgain();
        });

        assertThat(jdbcTemplate.queryForObject(
                "select owned_count from member_card where card_id = ?", Integer.class, cardId)).isEqualTo(2);
        assertThat(jdbcTemplate.queryForObject(
                "select seen_at from member_card where card_id = ?", OffsetDateTime.class, cardId)).isNotNull();
    }

    private GachaDrawResponseDto draw(String key, int count) {
        return gachaService.draw(memberId, key, new GachaDrawRequestDto(count));
    }

    /**
     * Runs {@code first} in a transaction and keeps it open, starts {@code second}, waits until
     * PostgreSQL reports the second blocked by the first's backend, then lets the first commit,
     * or roll back.
     *
     * <p>The first is released whatever happens. It commits only when the race went as
     * planned; if a check failed or the hold timed out it rolls back, so no lock and no row
     * outlives the test. The first has ended by the time this returns or throws.
     */
    private <T, U> Race<T, U> race(Supplier<T> first, boolean rollBackFirst, Supplier<U> second) throws Exception {
        CountDownLatch held = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        AtomicBoolean raceWentAsPlanned = new AtomicBoolean();
        AtomicInteger firstBackend = new AtomicInteger();
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);

        CompletableFuture<T> firstResult = CompletableFuture.supplyAsync(() -> transaction.execute(status -> {
            T result = first.get();
            // Same connection as the request's statements: the template joins this transaction.
            firstBackend.set(jdbcTemplate.queryForObject("select pg_backend_pid()", Integer.class));
            held.countDown();
            boolean released = await(release);
            if (!released || rollBackFirst || !raceWentAsPlanned.get()) {
                status.setRollbackOnly();
            }
            return result;
        }), executor);

        CompletableFuture<U> secondResult;
        try {
            assertThat(held.await(5, TimeUnit.SECONDS)).as("the first request reached its hold").isTrue();
            secondResult = CompletableFuture.supplyAsync(second, executor);
            awaitBlockedBy(firstBackend.get(), secondResult);
            raceWentAsPlanned.set(true);
        } finally {
            release.countDown();
            firstResult.handle((result, failure) -> null).get(10, TimeUnit.SECONDS);
        }
        return new Race<>(firstResult.get(), secondResult);
    }

    /**
     * Waits until a database session is blocked by {@code backendPid}, the held transaction.
     * Only the second request can be: nothing else in the test touches the database meanwhile.
     */
    private void awaitBlockedBy(int backendPid, CompletableFuture<?> second) throws InterruptedException {
        long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(5);
        while (System.nanoTime() < deadline) {
            if (second.isDone()) {
                fail("the second request ended without waiting for the first");
            }
            Integer blocked = jdbcTemplate.queryForObject(
                    "select count(*) from pg_stat_activity where ? = any(pg_blocking_pids(pid))",
                    Integer.class, backendPid);
            if (blocked > 0) {
                return;
            }
            Thread.sleep(20);
        }
        fail("the second request was never blocked by the first");
    }

    private static void assertRejectedWith(CompletableFuture<?> request, ErrorCode errorCode) {
        assertThatThrownBy(() -> request.get(5, TimeUnit.SECONDS))
                .isInstanceOf(ExecutionException.class)
                .cause()
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(errorCode);
    }

    /** @return {@code false} when the latch timed out */
    private static boolean await(CountDownLatch latch) {
        try {
            return latch.await(10, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        }
    }

    /** @param first what the held request returned, after it ended */
    private record Race<T, U>(T first, CompletableFuture<U> second) {
    }

}
