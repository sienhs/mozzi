package com.ssafy.mozzi.domain.diary.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.function.Consumer;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.mozzi.domain.diary.dto.DiaryCreateRequestDto;
import com.ssafy.mozzi.domain.diary.dto.DiaryUpdateRequestDto;
import com.ssafy.mozzi.domain.diary.entity.Diary;
import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.diary.repository.DiaryRepository;
import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.global.exception.BusinessException;
import com.ssafy.mozzi.global.exception.CommonErrorCode;
import com.ssafy.mozzi.support.IntegrationTest;

/**
 * Lost updates between writers of the same diary.
 *
 * <p>Each test holds the row in a first transaction, as a request part-way through a write
 * would, and sends a second write through the service meanwhile. The second write must wait
 * for the first to commit and then work from the committed row. Without the lock it read
 * the stale row, and saving it put back what the first writer had changed — including
 * {@code deleted_at = null}, which brought a deleted diary back.
 */
@IntegrationTest
class DiaryConcurrencyTest {

    /** Long enough that an unblocked write would certainly have finished. */
    private static final long BLOCKED_FOR_MILLIS = 500;

    @Autowired
    private DiaryService diaryService;

    @Autowired
    private DiaryRepository diaryRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private Clock clock;

    private Long memberId;
    private Long diaryId;

    @BeforeEach
    void setUp() {
        jdbcTemplate.execute("truncate table member cascade");
        memberId = memberRepository.saveAndFlush(
                Member.signUp("me@gmail.com", AuthProvider.GOOGLE, "me", "me")).getId();
        diaryId = diaryService.create(memberId, new DiaryCreateRequestDto(
                LocalDate.now(clock), Emotion.CALM, List.of(), "처음 메모")).diaryId();
    }

    @Test
    void memoEditDoesNotRevertAConcurrentEmotionChange() throws Exception {
        CompletableFuture<Void> edit = whileHeldBy(
                diary -> diary.changeEmotion(Emotion.HAPPY),
                () -> diaryService.update(memberId, diaryId, new DiaryUpdateRequestDto(null, null, "새 메모")));

        edit.get(5, TimeUnit.SECONDS);
        Diary saved = diaryRepository.findById(diaryId).orElseThrow();
        assertThat(saved.getEmotion()).isEqualTo(Emotion.HAPPY);
        assertThat(saved.getMemo()).isEqualTo("새 메모");
    }

    @Test
    void editRacingADeleteDoesNotBringTheDiaryBack() throws Exception {
        CompletableFuture<Void> edit = whileHeldBy(
                diary -> diary.delete(clock),
                () -> diaryService.update(memberId, diaryId, new DiaryUpdateRequestDto(null, null, "새 메모")));

        assertThatThrownBy(() -> edit.get(5, TimeUnit.SECONDS))
                .isInstanceOf(ExecutionException.class)
                .cause()
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(CommonErrorCode.NOT_FOUND);
        assertThat(jdbcTemplate.queryForObject(
                "select deleted_at is not null from diary where diary_id = ?", Boolean.class, diaryId))
                .isTrue();
    }

    /**
     * Holds the diary's row lock in another thread, applies {@code firstWrite} there, starts
     * {@code secondWrite}, checks that it is blocked, then lets the first commit.
     *
     * @return the second write, completed or failed once it got past the lock
     */
    private CompletableFuture<Void> whileHeldBy(Consumer<Diary> firstWrite, Runnable secondWrite)
            throws Exception {
        CountDownLatch held = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);

        CompletableFuture<Void> first = CompletableFuture.runAsync(() -> transaction.executeWithoutResult(status -> {
            firstWrite.accept(diaryRepository.findForUpdate(diaryId, memberId).orElseThrow());
            held.countDown();
            await(release);
        }));
        assertThat(held.await(5, TimeUnit.SECONDS)).isTrue();

        CompletableFuture<Void> second = CompletableFuture.runAsync(secondWrite);
        assertThatThrownBy(() -> second.get(BLOCKED_FOR_MILLIS, TimeUnit.MILLISECONDS))
                .as("the second write must wait for the first to commit")
                .isInstanceOf(TimeoutException.class);

        release.countDown();
        first.get(5, TimeUnit.SECONDS);
        return second;
    }

    private static void await(CountDownLatch latch) {
        try {
            latch.await(10, TimeUnit.SECONDS);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException(e);
        }
    }

}
