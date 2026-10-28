package com.ssafy.mozzi.domain.image.service;

import java.util.function.Predicate;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.mozzi.domain.diary.entity.Diary;
import com.ssafy.mozzi.domain.diary.repository.DiaryRepository;
import com.ssafy.mozzi.domain.image.entity.DiaryImage;
import com.ssafy.mozzi.domain.image.entity.ImageStatus;
import com.ssafy.mozzi.domain.image.exception.ImageErrorCode;
import com.ssafy.mozzi.domain.image.repository.DiaryImageRepository;

/**
 * Settles a pending picture request: the AI server's result, or a request that never reached
 * the queue.
 *
 * <p>Each call locks the diary row first, the same lock the member's picture request takes.
 * Only a pending request changes, so a result SQS delivers twice is applied once. There is no
 * timeout: a request stays pending until the AI server answers, and the member cannot ask
 * again meanwhile, so a result can only belong to the request that is pending.
 */
@Service
public class DiaryImageResultService {

    private static final Logger log = LoggerFactory.getLogger(DiaryImageResultService.class);

    private final DiaryRepository diaryRepository;
    private final DiaryImageRepository diaryImageRepository;
    private final ApplicationEventPublisher eventPublisher;

    public DiaryImageResultService(
            DiaryRepository diaryRepository,
            DiaryImageRepository diaryImageRepository,
            ApplicationEventPublisher eventPublisher) {
        this.diaryRepository = diaryRepository;
        this.diaryImageRepository = diaryImageRepository;
        this.eventPublisher = eventPublisher;
    }

    /**
     * The AI server finished the picture.
     *
     * @param memberId the owner the AI server named; a result for someone else's diary is
     *                 dropped
     */
    @Transactional
    public void succeed(Long diaryId, Long memberId, String imageUrl) {
        settle(diaryId, memberId, "succeeded", image -> image.succeed(imageUrl), null);
    }

    /**
     * The AI server could not make the picture. Counts toward the member's limit.
     *
     * @param memberId the owner the AI server named; a result for someone else's diary is
     *                 dropped
     */
    @Transactional
    public void fail(Long diaryId, Long memberId) {
        settle(diaryId, memberId, "failed", DiaryImage::fail, null);
    }

    /**
     * The member's picks were judged unfit to draw, so the request never reached the AI
     * server. Counts toward the limit all the same: the same picks would be judged the same
     * way again, and each try costs a model call.
     */
    @Transactional
    public void reject(Long diaryId) {
        settle(diaryId, null, "rejected", DiaryImage::fail, ImageErrorCode.INAPPROPRIATE_CONTENT);
    }

    /**
     * Never reached the AI server. Not counted against the member.
     *
     * <p>Its own transaction, because one caller runs inside the after-commit callback of the
     * member's request: joining that already-committed transaction would silently write
     * nothing.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void abandon(Long diaryId) {
        settle(diaryId, null, "abandoned", DiaryImage::abandon, null);
    }

    /**
     * @param memberId the owner a result from the AI server names, or {@code null} for an
     *                 outcome decided here. A mismatch means the AI server mixed requests up;
     *                 applying it would put a picture on someone else's diary and push it to
     *                 them, so it is dropped
     */
    private void settle(
            Long diaryId, Long memberId, String outcome, Predicate<DiaryImage> change, ImageErrorCode reason) {
        Diary diary = diaryRepository.findByIdForUpdate(diaryId).orElse(null);
        if (diary != null && memberId != null && !memberId.equals(diary.getMemberId())) {
            log.warn("image pipeline: step=ignored outcome={} diaryId={} reason=owner-mismatch userId={}",
                    outcome, diaryId, memberId);
            return;
        }
        DiaryImage image = diary == null ? null : diaryImageRepository.findByDiaryId(diaryId).orElse(null);
        if (image == null || !change.test(image)) {
            log.info("image pipeline: step=ignored outcome={} diaryId={} reason=not-pending", outcome, diaryId);
            return;
        }
        diary.showImageStatus(image.getStatus());
        log.info("image pipeline: step={} diaryId={} failures={}", outcome, diaryId, image.getFailureCount());
        String imageUrl = image.getStatus() == ImageStatus.SUCCEEDED ? image.getImageUrl() : null;
        eventPublisher.publishEvent(new ImageFinishedEvent(diaryId, image.getStatus(), imageUrl, reason));
    }

}
