package com.ssafy.mozzi.domain.image.service;

import java.time.Clock;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.mozzi.domain.diary.entity.Diary;
import com.ssafy.mozzi.domain.diary.repository.DiaryRepository;
import com.ssafy.mozzi.domain.gacha.service.MyMozziService;
import com.ssafy.mozzi.domain.icon.entity.IconCategory;
import com.ssafy.mozzi.domain.icon.entity.MyIcon;
import com.ssafy.mozzi.domain.image.dto.DiaryImageCreateRequestDto;
import com.ssafy.mozzi.domain.image.dto.DiaryImageCreateResponseDto;
import com.ssafy.mozzi.domain.image.entity.DiaryImage;
import com.ssafy.mozzi.domain.image.entity.ImageStatus;
import com.ssafy.mozzi.domain.image.exception.ImageErrorCode;
import com.ssafy.mozzi.domain.image.repository.DiaryImageRepository;
import com.ssafy.mozzi.global.exception.BusinessException;
import com.ssafy.mozzi.global.exception.CommonErrorCode;
import com.ssafy.mozzi.global.idempotency.IdempotencyStore;

/**
 * Requesting a diary's picture. The picture is made asynchronously after the request
 * commits, and the member hears of the result by push ({@link ImagePushListener}).
 */
@Service
public class DiaryImageService {

    private static final Logger log = LoggerFactory.getLogger(DiaryImageService.class);

    private final DiaryRepository diaryRepository;
    private final DiaryImageRepository diaryImageRepository;
    private final IdempotencyStore idempotencyStore;
    private final MyMozziService myMozziService;
    private final ApplicationEventPublisher eventPublisher;
    private final Clock clock;

    public DiaryImageService(
            DiaryRepository diaryRepository,
            DiaryImageRepository diaryImageRepository,
            IdempotencyStore idempotencyStore,
            MyMozziService myMozziService,
            ApplicationEventPublisher eventPublisher,
            Clock clock) {
        this.diaryRepository = diaryRepository;
        this.diaryImageRepository = diaryImageRepository;
        this.idempotencyStore = idempotencyStore;
        this.myMozziService = myMozziService;
        this.eventPublisher = eventPublisher;
        this.clock = clock;
    }

    /**
     * Starts the diary's picture, or starts it again after a failure. Only on the diary's own
     * day: a past diary keeps whatever picture it ended up with.
     *
     * <p>The diary row is locked first. Two requests for the same diary (a double tap) would
     * otherwise both see "no picture yet" and both start one; with the lock the second waits
     * until the first commits and then finds the picture {@code PENDING}.
     *
     * <p>A resend with the same {@code Idempotency-Key} gets the first response back, so it
     * says {@code PENDING} even once the picture is done. A retry after a failure is a new
     * request with a new key. The endpoint recorded carries the diary id, since the body hash
     * alone would not tell two diaries apart.
     */
    @Transactional
    public DiaryImageCreateResponseDto request(
            Long memberId, Long diaryId, String idempotencyKey, DiaryImageCreateRequestDto request) {
        return idempotencyStore.run(memberId, "POST /diaries/" + diaryId + "/image", idempotencyKey, request,
                HttpStatus.ACCEPTED.value(), DiaryImageCreateResponseDto.class,
                () -> doRequest(memberId, diaryId, request));
    }

    private DiaryImageCreateResponseDto doRequest(Long memberId, Long diaryId, DiaryImageCreateRequestDto request) {
        Diary diary = diaryRepository.findForUpdate(diaryId, memberId)
                .orElseThrow(() -> new BusinessException(
                        CommonErrorCode.NOT_FOUND, "diary not found: diaryId=" + diaryId));
        if (!diary.getRecordDate().equals(LocalDate.now(clock))) {
            throw new BusinessException(ImageErrorCode.IMAGE_ONLY_TODAY,
                    "picture requested for " + diary.getRecordDate() + ": diaryId=" + diaryId);
        }
        Optional<DiaryImage> existing = diaryImageRepository.findByDiaryId(diaryId);
        existing.ifPresent(DiaryImageService::checkCanRetry);

        DiaryImage.Selection selection = selectionOf(diary, request);
        DiaryImage image;
        if (existing.isPresent()) {
            image = existing.get();
            image.retry(selection);
        } else {
            image = diaryImageRepository.save(DiaryImage.request(diaryId, selection));
        }

        log.info("image pipeline: step=requested diaryId={} failures={}", diaryId, image.getFailureCount());
        eventPublisher.publishEvent(new ImageGenerationRequestedEvent(diaryId));
        return new DiaryImageCreateResponseDto(diaryId, image.getStatus());
    }

    /**
     * {@link #request} without its limits, for testing the picture (S15P31D102-132,
     * temporary): any day's diary, a finished picture is drawn again over the old one, and
     * failures are not capped. Only a pending request still answers 409, because a result
     * carries nothing but the diary id. The AI server stores these pictures under {@code test/}.
     */
    @Transactional
    public DiaryImageCreateResponseDto requestForTest(
            Long memberId, Long diaryId, DiaryImageCreateRequestDto request) {
        Diary diary = diaryRepository.findForUpdate(diaryId, memberId)
                .orElseThrow(() -> new BusinessException(
                        CommonErrorCode.NOT_FOUND, "diary not found: diaryId=" + diaryId));
        Optional<DiaryImage> existing = diaryImageRepository.findByDiaryId(diaryId);
        if (existing.isPresent() && existing.get().getStatus() == ImageStatus.PENDING) {
            throw new BusinessException(ImageErrorCode.IMAGE_ALREADY_REQUESTED,
                    "image is PENDING: diaryId=" + diaryId);
        }

        DiaryImage.Selection selection = selectionOf(diary, request);
        DiaryImage image;
        if (existing.isPresent()) {
            image = existing.get();
            image.redrawForTest(selection);
        } else {
            image = diaryImageRepository.save(DiaryImage.request(diaryId, selection));
        }

        log.info("image pipeline: step=requested diaryId={} failures={} test=true",
                diaryId, image.getFailureCount());
        eventPublisher.publishEvent(new ImageGenerationRequestedEvent(diaryId, true));
        return new DiaryImageCreateResponseDto(diaryId, image.getStatus());
    }

    private static void checkCanRetry(DiaryImage image) {
        if (image.canRetry()) {
            return;
        }
        if (image.getStatus() == ImageStatus.FAILED) {
            throw new BusinessException(ImageErrorCode.RETRY_LIMIT_EXCEEDED,
                    "image failed " + image.getFailureCount() + " times: diaryId=" + image.getDiaryId());
        }
        throw new BusinessException(ImageErrorCode.IMAGE_ALREADY_REQUESTED,
                "image is " + image.getStatus() + ": diaryId=" + image.getDiaryId());
    }

    /**
     * Turns the picked icon ids into names, and takes the member's mozzi for the diary's
     * emotion. Each icon must be one of the diary's live icons and in the category it was
     * sent for.
     */
    private DiaryImage.Selection selectionOf(Diary diary, DiaryImageCreateRequestDto request) {
        List<MyIcon> diaryIcons = diaryRepository.findActiveIcons(diary.getId());
        return new DiaryImage.Selection(
                myMozziService.cardFor(diary.getMemberId(), diary.getEmotion()).orElse(null),
                request.timeOfDay(),
                request.weather(),
                nameOf(diaryIcons, request.whereMyIconId(), IconCategory.WHERE),
                nameOf(diaryIcons, request.whoMyIconId(), IconCategory.WHO),
                nameOf(diaryIcons, request.whatMyIconId(), IconCategory.WHAT));
    }

    private static String nameOf(List<MyIcon> diaryIcons, Long myIconId, IconCategory category) {
        if (myIconId == null) {
            return null;
        }
        return diaryIcons.stream()
                .filter(icon -> icon.getId().equals(myIconId) && icon.getCategory() == category)
                .findFirst()
                .map(MyIcon::getName)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.INVALID_INPUT,
                        "icon " + myIconId + " is not a " + category + " icon of the diary",
                        "이 일기에 고른 아이콘 중에서 골라 주세요."));
    }

}
