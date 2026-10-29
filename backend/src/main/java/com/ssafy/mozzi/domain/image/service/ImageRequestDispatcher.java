package com.ssafy.mozzi.domain.image.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.mozzi.domain.diary.entity.Diary;
import com.ssafy.mozzi.domain.diary.repository.DiaryRepository;
import com.ssafy.mozzi.domain.gacha.entity.MozziCard;
import com.ssafy.mozzi.domain.gacha.repository.MozziCardRepository;
import com.ssafy.mozzi.domain.gacha.service.GachaProperties;
import com.ssafy.mozzi.domain.image.entity.DiaryImage;
import com.ssafy.mozzi.domain.image.entity.ImageStatus;
import com.ssafy.mozzi.domain.image.entity.TimeOfDay;
import com.ssafy.mozzi.domain.image.entity.Weather;
import com.ssafy.mozzi.domain.image.exception.InappropriatePromptException;
import com.ssafy.mozzi.domain.image.repository.DiaryImageRepository;

/**
 * Translates a committed picture request and hands it to the AI server, unless the
 * translation judged the member's picks unfit to draw.
 *
 * <p>Runs on the image executor, after the member's request has already been answered, so a
 * slow translation never holds the diary lock or the request thread. Nothing here holds a
 * transaction while calling out: the request is read in a short read-only one, and the
 * outcome, if the hand-over fails, is written in its own.
 */
@Component
public class ImageRequestDispatcher {

    private static final Logger log = LoggerFactory.getLogger(ImageRequestDispatcher.class);

    /** Sent as the character image when there is none; the AI server draws its own default. */
    static final String DEFAULT_CHARACTER_IMAGE = "DEFAULT";

    private final DiaryRepository diaryRepository;
    private final DiaryImageRepository diaryImageRepository;
    private final MozziCardRepository mozziCardRepository;
    private final PromptTranslator translator;
    private final ImageRequestPublisher publisher;
    private final DiaryImageResultService resultService;
    private final ImageProperties properties;
    private final GachaProperties gachaProperties;
    private final TransactionTemplate readOnly;

    public ImageRequestDispatcher(
            DiaryRepository diaryRepository,
            DiaryImageRepository diaryImageRepository,
            MozziCardRepository mozziCardRepository,
            PromptTranslator translator,
            ImageRequestPublisher publisher,
            DiaryImageResultService resultService,
            ImageProperties properties,
            GachaProperties gachaProperties,
            PlatformTransactionManager transactionManager) {
        this.diaryRepository = diaryRepository;
        this.diaryImageRepository = diaryImageRepository;
        this.mozziCardRepository = mozziCardRepository;
        this.translator = translator;
        this.publisher = publisher;
        this.resultService = resultService;
        this.properties = properties;
        this.gachaProperties = gachaProperties;
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
                    image.getWhereName(), image.getWhoName(), image.getWhatName()));
            log.info("image pipeline: step=translated diaryId={} millis={}", diaryId, millisSince(started));

            step = "queue";
            started = System.nanoTime();
            publisher.publish(messageFor(request, english, event.test()));
            log.info("image pipeline: step=queued diaryId={} test={} millis={}",
                    diaryId, event.test(), millisSince(started));
        } catch (InappropriatePromptException e) {
            log.info("image pipeline: step=blocked diaryId={}", diaryId);
            resultService.reject(diaryId);
        } catch (RuntimeException e) {
            // Not the member's failure: they can ask again without using up a try.
            log.error("image pipeline: step={}-failed diaryId={}", step, diaryId, e);
            resultService.abandon(diaryId);
        }
    }

    private Request load(Long diaryId) {
        Diary diary = diaryRepository.findById(diaryId).orElse(null);
        DiaryImage image = diaryImageRepository.findByDiaryId(diaryId).orElse(null);
        if (diary == null || image == null) {
            return null;
        }
        MozziCard card = image.getMozziCardId() == null
                ? null
                : mozziCardRepository.findById(image.getMozziCardId()).orElse(null);
        return new Request(diary, image, card);
    }

    /** The AI server takes {@code ""}, not {@code null}, for anything not picked or not set up. */
    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    private static String characterImageUrl(String configured) {
        return configured == null || configured.isBlank() ? DEFAULT_CHARACTER_IMAGE : configured;
    }

    /**
     * Empty for the default character: the AI server draws it from its own description, and
     * a second one from here could disagree with it.
     */
    private static String characterPrompt(String characterImageUrl, String configured) {
        return DEFAULT_CHARACTER_IMAGE.equals(characterImageUrl) ? "" : nullToEmpty(configured);
    }

    private static long millisSince(long startedNanos) {
        return (System.nanoTime() - startedNanos) / 1_000_000;
    }

    private ImageRequestPublisher.Message messageFor(
            Request request, PromptTranslator.Translation english, boolean test) {
        Diary diary = request.diary();
        DiaryImage image = request.image();
        TimeOfDay timeOfDay = image.getTimeOfDay();
        Weather weather = image.getWeather();
        MozziCard card = request.card();
        String characterImageUrl;
        String characterPrompt;
        if (card != null) {
            characterImageUrl = gachaProperties.imageUrl(card.getImageKey());
            characterPrompt = nullToEmpty(card.getPrompt());
        } else {
            characterImageUrl = characterImageUrl(properties.defaultCharacterImageUrl());
            characterPrompt = characterPrompt(characterImageUrl, properties.defaultCharacterPrompt());
        }
        return new ImageRequestPublisher.Message(
                diary.getId(),
                diary.getMemberId(),
                diary.getRecordDate().toString(),
                diary.getEmotion().name(),
                characterImageUrl,
                characterPrompt,
                timeOfDay == null ? "" : timeOfDay.english(),
                weather.english(),
                nullToEmpty(english.where()),
                nullToEmpty(english.who()),
                english.what(),
                test);
    }

    /** @param card the member's mozzi drawn into the picture, or {@code null} for the default */
    private record Request(Diary diary, DiaryImage image, MozziCard card) {
    }

}
