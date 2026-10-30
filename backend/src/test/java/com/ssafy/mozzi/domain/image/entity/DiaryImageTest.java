package com.ssafy.mozzi.domain.image.entity;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

/**
 * The state rules that make a result with only a diary id safe to apply: only a pending
 * request changes, and a pending request cannot be replaced.
 */
class DiaryImageTest {

    private static final DiaryImage.Selection PICK = new DiaryImage.Selection(null, null, null, null, "요리");

    @Test
    void aNewRequestIsPending() {
        DiaryImage image = DiaryImage.request(10L, PICK);

        assertThat(image.getStatus()).isEqualTo(ImageStatus.PENDING);
        assertThat(image.getFailureCount()).isZero();
        assertThat(image.canRetry()).isFalse();
    }

    @Test
    void anAiFailureCountsAndCanBeRetriedWithNewPicks() {
        DiaryImage image = DiaryImage.request(10L, PICK);

        assertThat(image.fail()).isTrue();
        assertThat(image.getFailureCount()).isEqualTo(1);
        assertThat(image.canRetry()).isTrue();

        image.retry(new DiaryImage.Selection(TimeOfDay.LUNCH, null, "우리집", null, "독서"));
        assertThat(image.getStatus()).isEqualTo(ImageStatus.PENDING);
        assertThat(image.getWhatName()).isEqualTo("독서");
    }

    /** SQS may deliver the same result twice. */
    @Test
    void aDuplicateResultChangesNothing() {
        DiaryImage image = DiaryImage.request(10L, PICK);
        image.fail();
        assertThat(image.fail()).isFalse();
        assertThat(image.getFailureCount()).isEqualTo(1);

        DiaryImage done = DiaryImage.request(11L, PICK);
        done.succeed("https://cdn.test/a.webp");
        assertThat(done.succeed("https://cdn.test/b.webp")).isFalse();
        assertThat(done.getImageUrl()).isEqualTo("https://cdn.test/a.webp");
    }

    @Test
    void aRequestThatNeverReachedTheAiServerIsNotCounted() {
        DiaryImage image = DiaryImage.request(10L, PICK);

        assertThat(image.abandon()).isTrue();
        assertThat(image.getStatus()).isEqualTo(ImageStatus.FAILED);
        assertThat(image.getFailureCount()).isZero();
        assertThat(image.canRetry()).isTrue();
    }

    @Test
    void threeFailuresEndIt() {
        DiaryImage image = DiaryImage.request(10L, PICK);
        for (int i = 1; i <= DiaryImage.MAX_FAILURES; i++) {
            image.fail();
            if (i < DiaryImage.MAX_FAILURES) {
                image.retry(PICK);
            }
        }

        assertThat(image.canRetry()).isFalse();
        assertThatThrownBy(() -> image.retry(PICK)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void aFinishedPictureCannotBeRetriedOrUndone() {
        DiaryImage image = DiaryImage.request(10L, PICK);
        image.succeed("https://cdn.test/done.webp");

        assertThat(image.canRetry()).isFalse();
        assertThat(image.fail()).isFalse();
        assertThat(image.abandon()).isFalse();
        assertThat(image.getStatus()).isEqualTo(ImageStatus.SUCCEEDED);
    }

}
