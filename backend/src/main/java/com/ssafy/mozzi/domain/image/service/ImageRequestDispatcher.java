package com.ssafy.mozzi.domain.image.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.mozzi.domain.diary.entity.Diary;
import com.ssafy.mozzi.domain.diary.repository.DiaryRepository;
import com.ssafy.mozzi.domain.image.entity.DiaryImage;
import com.ssafy.mozzi.domain.image.entity.ImageStatus;
import com.ssafy.mozzi.domain.image.entity.TimeOfDay;
import com.ssafy.mozzi.domain.image.repository.DiaryImageRepository;

/**
 * Translates a committed picture request and hands it to the AI server.
 *
 * <p>Runs on the image executor, after the member's request has already been answered, so a
 * slow translation never holds the diary lock or the request thread. Nothing here holds a
 * transaction while calling out: the request is read in a short read-only one, and the
 * outcome, if the hand-over fails, is written in its own.
 */
@Component
public class ImageRequestDispatcher {

    private static final Logger log = LoggerFactory.getLogger(ImageRequestDispatcher.class);

    private final DiaryRepository diaryRepository;
    private final DiaryImageRepository diaryImageRepository;
    private final PromptTranslator translator;
    private final ImageRequestPublisher publisher;
    private final DiaryImageResultService resultService;
    private final ImageProperties properties;
    private final TransactionTemplate readOnly;

    public ImageRequestDispatcher(
            DiaryRepository diaryRepository,
            DiaryImageRepository diaryImageRepository,
            PromptTranslator translator,
            ImageRequestPublisher publisher,
            DiaryImageResultService resultService,
            ImageProperties properties,
            PlatformTransactionManager transactionManager) {
        this.diaryRepository = diaryRepository;
        this.diaryImageRepository = diaryImageRepository;
        this.translator = translator;
        this.publisher = publisher;
        this.resultService = resultService;
        this.properties = properties;
        this.readOnly = new TransactionTemplate(transactionManager);
        this.readOnly.setReadOnly(true);
    }

    /**
     * Logs one INFO line per step ({@code image pipeline: step=...}) with the diary id, so one
     * search for it shows how far its picture got. What the member wrote is never logged,
     * only ids and timings.
     */
    public void dispatch(ImageGenerationRequestedEvent event) {
        Long diaryId = event.diaryId();
        log.info("image pipeline: step=dispatch-start diaryId={}", diaryId);
        Request request = readOnly.execute(status -> load(diaryId));
        if (request == null || request.image().getStatus() != ImageStatus.PENDING) {
            log.info("image pipeline: step=skipped reason=not-pending diaryId={}", diaryId);
            return;
        }
        DiaryImage image = request.image();
        String step = "translate";
        try {
            long started = System.nanoTime();
            PromptTranslator.Translation english = translator.translate(new PromptTranslator.Source(
                    image.getWhereName(), image.getWhoName(), image.getWhatName(), properties.defaultCharacterPrompt()));
            log.info("image pipeline: step=translated diaryId={} millis={}", diaryId, millisSince(started));

            step = "queue";
            started = System.nanoTime();
            publisher.publish(messageFor(request, english));
            log.info("image pipeline: step=queued diaryId={} millis={}", diaryId, millisSince(started));
        } catch (RuntimeException e) {
            // Not the member's failure: they can ask again without using up a try.
            log.error("image pipeline: step={}-failed diaryId={}", step, diaryId, e);
            resultService.abandon(diaryId);
        }
    }

    private Request load(Long diaryId) {
        Diary diary = diaryRepository.findById(diaryId).orElse(null);
        DiaryImage image = diaryImageRepository.findByDiaryId(diaryId).orElse(null);
        return diary == null || image == null ? null : new Request(diary, image);
    }

    /** The character image is not set up yet; an unset value goes out as {@code null}, not {@code ""}. */
    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    private static long millisSince(long startedNanos) {
        return (System.nanoTime() - startedNanos) / 1_000_000;
    }

    private ImageRequestPublisher.Message messageFor(Request request, PromptTranslator.Translation english) {
        Diary diary = request.diary();
        DiaryImage image = request.image();
        TimeOfDay timeOfDay = image.getTimeOfDay();
        return new ImageRequestPublisher.Message(
                diary.getId(),
                diary.getMemberId(),
                diary.getRecordDate().toString(),
                diary.getEmotion().name(),
                blankToNull(properties.defaultCharacterImageUrl()),
                english.character(),
                timeOfDay == null ? null : timeOfDay.english(),
                english.where(),
                english.who(),
                english.what());
    }

    private record Request(Diary diary, DiaryImage image) {
    }

}
