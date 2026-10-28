package com.ssafy.mozzi.domain.image.service;

import java.util.LinkedHashMap;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

import com.ssafy.mozzi.domain.diary.entity.Diary;
import com.ssafy.mozzi.domain.diary.repository.DiaryRepository;
import com.ssafy.mozzi.domain.image.entity.DiaryImage;
import com.ssafy.mozzi.domain.image.entity.ImageStatus;
import com.ssafy.mozzi.domain.image.exception.ImageErrorCode;
import com.ssafy.mozzi.domain.image.repository.DiaryImageRepository;
import com.ssafy.mozzi.domain.member.service.PushMessage;
import com.ssafy.mozzi.domain.member.service.PushNotifier;

/**
 * Tells the member their picture is done, or that it failed, with a push.
 *
 * <p>Runs after the result commits, so no push goes out for a result that was rolled back,
 * and off the thread that settled it: that is the SQS poller, which would otherwise wait on
 * FCM before taking the next result.
 */
@Component
public class ImagePushListener {

    static final String TYPE = "DIARY_IMAGE";
    static final String TITLE_SUCCEEDED = "그림일기가 완성됐어요";
    static final String BODY_SUCCEEDED = "오늘의 그림을 확인해 보세요.";
    static final String TITLE_FAILED = "그림을 그리지 못했어요";
    static final String BODY_CAN_RETRY = "다시 그려 볼 수 있어요.";
    static final String BODY_NO_RETRY = "이 일기의 그림은 더 그릴 수 없어요.";

    private static final Logger log = LoggerFactory.getLogger(ImagePushListener.class);

    private final DiaryRepository diaryRepository;
    private final DiaryImageRepository diaryImageRepository;
    private final PushNotifier pushNotifier;

    public ImagePushListener(
            DiaryRepository diaryRepository, DiaryImageRepository diaryImageRepository, PushNotifier pushNotifier) {
        this.diaryRepository = diaryRepository;
        this.diaryImageRepository = diaryImageRepository;
        this.pushNotifier = pushNotifier;
    }

    @Async
    @TransactionalEventListener
    public void onFinished(ImageFinishedEvent event) {
        Diary diary = diaryRepository.findById(event.diaryId()).orElse(null);
        DiaryImage image = diaryImageRepository.findByDiaryId(event.diaryId()).orElse(null);
        if (diary == null || image == null) {
            log.info("image pipeline: step=not-pushed reason=gone diaryId={}", event.diaryId());
            return;
        }
        int reached = pushNotifier.notify(diary.getMemberId(), messageFor(event, diary, image));
        log.info("image pipeline: step=pushed diaryId={} status={} devices={}", event.diaryId(), event.status(), reached);
    }

    static PushMessage messageFor(ImageFinishedEvent event, Diary diary, DiaryImage image) {
        Map<String, String> data = new LinkedHashMap<>();
        data.put("type", TYPE);
        data.put("diaryId", String.valueOf(diary.getId()));
        data.put("recordDate", diary.getRecordDate().toString());
        data.put("status", event.status().name());
        if (event.status() == ImageStatus.SUCCEEDED) {
            data.put("imageUrl", event.imageUrl());
            return new PushMessage(TITLE_SUCCEEDED, BODY_SUCCEEDED, data);
        }
        ImageErrorCode reason = event.reason();
        if (reason != null) {
            data.put("code", reason.code());
        }
        // The reason's text asks the member to try again, which is wrong once the tries are used up.
        String body = !image.canRetry() ? BODY_NO_RETRY : reason != null ? reason.message() : BODY_CAN_RETRY;
        return new PushMessage(TITLE_FAILED, body, data);
    }

}
