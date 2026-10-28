package com.ssafy.mozzi.domain.image.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.after;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Map;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.image.entity.ImageStatus;
import com.ssafy.mozzi.domain.image.exception.ImageErrorCode;
import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.domain.member.service.PushMessage;
import com.ssafy.mozzi.domain.member.service.PushSender;
import com.ssafy.mozzi.support.DiaryFixtures;
import com.ssafy.mozzi.support.IntegrationTest;

/**
 * Results and the push that reports them, against the real schema. FCM is replaced by a mock.
 */
@IntegrationTest
class DiaryImageResultServiceTest {

    /** The push goes out on another thread after commit. */
    private static final int PUSH_WAIT_MILLIS = 5_000;

    @Autowired
    private DiaryImageResultService resultService;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private Clock clock;

    @MockitoBean
    private PushSender pushSender;

    private DiaryFixtures fixtures;
    private Long me;
    private Long diaryId;

    @BeforeEach
    void setUp() {
        fixtures = new DiaryFixtures(jdbcTemplate);
        fixtures.reset();
        me = memberRepository.saveAndFlush(Member.signUp("me@gmail.com", AuthProvider.GOOGLE, "me", "me")).getId();
        diaryId = fixtures.diary(me, LocalDate.now(clock), fixtures.emoticon(Emotion.CALM), Emotion.CALM);
        fixtures.picture(diaryId, ImageStatus.PENDING, 0, null);
        when(pushSender.send(any(), any())).thenReturn(PushSender.Outcome.SENT);
    }

    @Test
    void aSuccessStoresTheUrlOnBothRows() {
        resultService.succeed(diaryId, me, "https://cdn.test/diary/done.webp");

        assertThat(picture()).containsEntry("status", "SUCCEEDED").containsEntry("image_url", "https://cdn.test/diary/done.webp");
        assertThat(diaryStatus()).isEqualTo("SUCCEEDED");
    }

    /** SQS may deliver the same failure twice; it counts once. */
    @Test
    void anAiFailureCountsOnce() {
        resultService.fail(diaryId, me);
        resultService.fail(diaryId, me);

        assertThat(picture()).containsEntry("status", "FAILED").containsEntry("failure_count", 1);
        assertThat(diaryStatus()).isEqualTo("FAILED");
    }

    @Test
    void aDuplicateSuccessChangesNothing() {
        resultService.succeed(diaryId, me, "https://cdn.test/diary/done.webp");
        resultService.succeed(diaryId, me, "https://cdn.test/diary/again.webp");

        assertThat(picture()).containsEntry("image_url", "https://cdn.test/diary/done.webp");
    }

    /** The AI server named someone other than the diary's owner: nothing is applied or pushed. */
    @Test
    void aResultNamingAnotherMemberIsDropped() {
        Long someoneElse = memberRepository.saveAndFlush(
                Member.signUp("other@gmail.com", AuthProvider.GOOGLE, "other", "other")).getId();
        device("fcm-me", true);

        resultService.succeed(diaryId, someoneElse, "https://cdn.test/diary/wrong.webp");
        resultService.fail(diaryId, someoneElse);

        assertThat(picture()).containsEntry("status", "PENDING").containsEntry("failure_count", 0);
        verify(pushSender, after(1_000).never()).send(any(), any());
    }

    @Test
    void aResultForAnUnknownDiaryIsIgnored() {
        resultService.succeed(999_999L, me, "https://cdn.test/diary/x.webp");

        assertThat(picture()).containsEntry("status", "PENDING");
    }

    /** A request that never reached the AI server fails without using up a try. */
    @Test
    void anAbandonedRequestIsNotCounted() {
        resultService.abandon(diaryId);

        assertThat(picture()).containsEntry("status", "FAILED").containsEntry("failure_count", 0);
        assertThat(diaryStatus()).isEqualTo("FAILED");
    }

    /** Unfit picks use up a try: the same picks would be judged the same way again. */
    @Test
    void aRejectedRequestIsCounted() {
        resultService.reject(diaryId);

        assertThat(picture()).containsEntry("status", "FAILED").containsEntry("failure_count", 1);
        assertThat(diaryStatus()).isEqualTo("FAILED");
    }

    /**
     * When the executor is full, abandon runs in the after-commit callback of the member's
     * request. Joining that committed transaction would silently write nothing.
     */
    @Test
    void abandoningFromAnAfterCommitCallbackIsWritten() {
        transactionTemplate.executeWithoutResult(status -> TransactionSynchronizationManager.registerSynchronization(
                new TransactionSynchronization() {
                    @Override
                    public void afterCommit() {
                        resultService.abandon(diaryId);
                    }
                }));

        assertThat(picture()).containsEntry("status", "FAILED");
    }

    @Test
    void aSuccessIsPushedToTheMembersDevice() {
        device("fcm-me", true);

        resultService.succeed(diaryId, me, "https://cdn.test/diary/done.webp");

        PushMessage push = pushed("fcm-me");
        assertThat(push.title()).isEqualTo(ImagePushListener.TITLE_SUCCEEDED);
        assertThat(push.data())
                .containsEntry("type", "DIARY_IMAGE")
                .containsEntry("diaryId", String.valueOf(diaryId))
                .containsEntry("recordDate", LocalDate.now(clock).toString())
                .containsEntry("status", "SUCCEEDED")
                .containsEntry("imageUrl", "https://cdn.test/diary/done.webp");
    }

    @Test
    void aRejectionIsPushedWithItsReason() {
        device("fcm-me", true);

        resultService.reject(diaryId);

        PushMessage push = pushed("fcm-me");
        assertThat(push.title()).isEqualTo(ImagePushListener.TITLE_FAILED);
        assertThat(push.body()).isEqualTo(ImageErrorCode.INAPPROPRIATE_CONTENT.message());
        assertThat(push.data()).containsEntry("status", "FAILED").containsEntry("code", "INAPPROPRIATE_CONTENT");
    }

    /** The last try failing must not tell the member to try again. */
    @Test
    void aFailureAtTheLimitSaysNoMoreTries() {
        jdbcTemplate.update("update diary_image set failure_count = 2 where diary_id = ?", diaryId);
        device("fcm-me", true);

        resultService.fail(diaryId, me);

        assertThat(pushed("fcm-me").body()).isEqualTo(ImagePushListener.BODY_NO_RETRY);
    }

    /** A request that never reached the AI server can be asked again for free. */
    @Test
    void anAbandonedRequestSaysTryAgain() {
        device("fcm-me", true);

        resultService.abandon(diaryId);

        PushMessage push = pushed("fcm-me");
        assertThat(push.body()).isEqualTo(ImagePushListener.BODY_CAN_RETRY);
        assertThat(push.data()).doesNotContainKey("code");
    }

    @Test
    void aSignedOutDeviceGetsNothing() {
        device("fcm-old", false);

        resultService.succeed(diaryId, me, "https://cdn.test/diary/done.webp");

        verify(pushSender, after(1_000).never()).send(any(), any());
    }

    /** SQS may deliver the same result twice; the member hears of it once. */
    @Test
    void aDuplicateResultIsPushedOnce() {
        device("fcm-me", true);

        resultService.succeed(diaryId, me, "https://cdn.test/diary/done.webp");
        resultService.succeed(diaryId, me, "https://cdn.test/diary/again.webp");

        verify(pushSender, after(1_000).times(1)).send(eq("fcm-me"), any());
    }

    /** FCM says the app is gone: the device is turned off so it is not tried again. */
    @Test
    void aDeadTokenIsTurnedOff() throws InterruptedException {
        device("fcm-gone", true);
        when(pushSender.send(eq("fcm-gone"), any())).thenReturn(PushSender.Outcome.TOKEN_INVALID);

        resultService.succeed(diaryId, me, "https://cdn.test/diary/done.webp");

        verify(pushSender, timeout(PUSH_WAIT_MILLIS)).send(eq("fcm-gone"), any());
        for (int i = 0; i < 50 && deviceActive("fcm-gone"); i++) {
            Thread.sleep(100);
        }
        assertThat(deviceActive("fcm-gone")).isFalse();
    }

    private Map<String, Object> picture() {
        return jdbcTemplate.queryForMap("select * from diary_image where diary_id = ?", diaryId);
    }

    private String diaryStatus() {
        return jdbcTemplate.queryForObject(
                "select diary_image_status from diary where diary_id = ?", String.class, diaryId);
    }

    private void device(String token, boolean active) {
        jdbcTemplate.update("""
                insert into push_device (member_id, device_id, platform, token, is_active, updated_at)
                values (?, ?, 'ANDROID', ?, ?, now())
                """, me, "device-" + token, token, active);
    }

    private boolean deviceActive(String token) {
        return Boolean.TRUE.equals(jdbcTemplate.queryForObject(
                "select is_active from push_device where token = ?", Boolean.class, token));
    }

    private PushMessage pushed(String token) {
        ArgumentCaptor<PushMessage> message = ArgumentCaptor.forClass(PushMessage.class);
        verify(pushSender, timeout(PUSH_WAIT_MILLIS)).send(eq(token), message.capture());
        return message.getValue();
    }

}
