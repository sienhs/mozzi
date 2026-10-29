package com.ssafy.mozzi.domain.diary.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.LocalDate;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.mozzi.domain.diary.entity.Diary;
import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.diary.repository.DiaryRepository;
import com.ssafy.mozzi.domain.icon.dto.MyIconCreateRequestDto;
import com.ssafy.mozzi.domain.icon.entity.IconCategory;
import com.ssafy.mozzi.domain.icon.entity.MyIcon;
import com.ssafy.mozzi.domain.icon.exception.MyIconErrorCode;
import com.ssafy.mozzi.domain.icon.repository.MyIconRepository;
import com.ssafy.mozzi.domain.icon.service.MyIconService;
import com.ssafy.mozzi.domain.image.dto.DiaryImageCreateRequestDto;
import com.ssafy.mozzi.domain.image.entity.DiaryImage;
import com.ssafy.mozzi.domain.image.exception.ImageErrorCode;
import com.ssafy.mozzi.domain.image.repository.DiaryImageRepository;
import com.ssafy.mozzi.domain.image.service.DiaryImageService;
import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.global.exception.BusinessException;
import com.ssafy.mozzi.global.exception.ErrorCode;
import com.ssafy.mozzi.support.DiaryFixtures;
import com.ssafy.mozzi.support.IntegrationTest;

/**
 * Double taps on the writes that a unique index cannot guard.
 *
 * <p>Each test holds the lock in a first transaction that is part-way through the same write,
 * and sends the second request through the service meanwhile. The second must wait for the
 * first to commit and then see its result. Without the lock both would see the state before
 * either wrote, and both would go through.
 */
@IntegrationTest
class DiaryConcurrencyTest {

    /** Long enough that an unblocked request would certainly have finished. */
    private static final long BLOCKED_FOR_MILLIS = 500;

    @Autowired
    private DiaryImageService diaryImageService;

    @Autowired
    private MyIconService myIconService;

    @Autowired
    private DiaryRepository diaryRepository;

    @Autowired
    private DiaryImageRepository diaryImageRepository;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private MyIconRepository myIconRepository;


    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private Clock clock;

    private DiaryFixtures fixtures;
    private Long memberId;
    private Long cooking;
    private Long diaryId;

    @BeforeEach
    void setUp() {
        fixtures = new DiaryFixtures(jdbcTemplate);
        fixtures.reset();
        memberId = memberRepository.saveAndFlush(
                Member.signUp("me@gmail.com", AuthProvider.GOOGLE, "me", "me")).getId();
        cooking = fixtures.myIcon(memberId, "요리", IconCategory.WHAT);
        diaryId = fixtures.diary(memberId, LocalDate.now(clock), fixtures.emoticon(Emotion.CALM), Emotion.CALM);
        fixtures.attach(diaryId, cooking);
    }

    @Test
    void aSecondPictureRequestWaitsAndIsRejected() throws Exception {
        CompletableFuture<Void> second = whileHeld(
                () -> {
                    Diary diary = diaryRepository.findForUpdate(diaryId, memberId).orElseThrow();
                    DiaryImage image = diaryImageRepository.save(DiaryImage.request(
                            diaryId, new DiaryImage.Selection(1L, null, null, null, null, "요리")));
                    diary.showImageStatus(image.getStatus());
                },
                () -> diaryImageService.request(memberId, diaryId, UUID.randomUUID().toString(),
                        new DiaryImageCreateRequestDto(1L, null, null, null, null, cooking)));

        assertRejectedWith(second, ImageErrorCode.IMAGE_ALREADY_REQUESTED);
        assertThat(jdbcTemplate.queryForObject(
                "select count(*) from diary_image where diary_id = ?", Integer.class, diaryId)).isEqualTo(1);
    }

    @Test
    void twoIconsAtEightDoNotMakeTen() throws Exception {
        for (int i = 0; i < MyIcon.MAX_PER_CATEGORY - 1; i++) {
            fixtures.myIcon(memberId, "장소" + i, IconCategory.WHERE);
        }

        CompletableFuture<Void> second = whileHeld(
                () -> {
                    memberRepository.findActiveByIdForUpdate(memberId).orElseThrow();
                    myIconRepository.save(MyIcon.create(memberId, "아홉째", IconCategory.WHERE));
                },
                () -> myIconService.create(memberId, new MyIconCreateRequestDto("열째", IconCategory.WHERE)));

        assertRejectedWith(second, MyIconErrorCode.MY_ICON_LIMIT_EXCEEDED);
        assertThat(myIconRepository.countByMemberIdAndCategoryAndDeletedAtIsNull(memberId, IconCategory.WHERE))
                .isEqualTo(MyIcon.MAX_PER_CATEGORY);
    }

    /**
     * Runs {@code firstWrite} in a transaction on another thread and keeps it open, starts
     * {@code secondWrite}, checks that it is blocked, then lets the first commit.
     *
     * @return the second write, completed or failed once it got past the lock
     */
    private CompletableFuture<Void> whileHeld(Runnable firstWrite, Runnable secondWrite) throws Exception {
        CountDownLatch held = new CountDownLatch(1);
        CountDownLatch release = new CountDownLatch(1);
        TransactionTemplate transaction = new TransactionTemplate(transactionManager);

        CompletableFuture<Void> first = CompletableFuture.runAsync(() -> transaction.executeWithoutResult(status -> {
            firstWrite.run();
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

    private static void assertRejectedWith(CompletableFuture<Void> write, ErrorCode errorCode) {
        assertThatThrownBy(() -> write.get(5, TimeUnit.SECONDS))
                .isInstanceOf(ExecutionException.class)
                .cause()
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(errorCode);
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
