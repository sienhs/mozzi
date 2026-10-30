package com.ssafy.mozzi.domain.image.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.transaction.PlatformTransactionManager;

import com.ssafy.mozzi.domain.diary.entity.Diary;
import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.diary.repository.DiaryRepository;
import com.ssafy.mozzi.domain.gacha.entity.CardTier;
import com.ssafy.mozzi.domain.gacha.entity.MozziCard;
import com.ssafy.mozzi.domain.gacha.repository.MozziCardRepository;
import com.ssafy.mozzi.domain.gacha.service.GachaProperties;
import com.ssafy.mozzi.domain.image.entity.DiaryImage;
import com.ssafy.mozzi.domain.image.entity.TimeOfDay;
import com.ssafy.mozzi.domain.image.entity.Weather;
import com.ssafy.mozzi.domain.image.exception.InappropriatePromptException;
import com.ssafy.mozzi.domain.image.repository.DiaryImageRepository;

class ImageRequestDispatcherTest {

    private final DiaryRepository diaryRepository = mock(DiaryRepository.class);
    private final DiaryImageRepository imageRepository = mock(DiaryImageRepository.class);
    private final MozziCardRepository cardRepository = mock(MozziCardRepository.class);
    private final DiaryImageResultService resultService = mock(DiaryImageResultService.class);
    private final List<ImageRequestPublisher.Message> sent = new ArrayList<>();
    private final List<PromptTranslator.Source> translated = new ArrayList<>();

    private ImageRequestDispatcher dispatcher;

    @BeforeEach
    void setUp() {
        Diary diary = mock(Diary.class);
        when(diary.getId()).thenReturn(10L);
        when(diary.getMemberId()).thenReturn(12L);
        when(diary.getRecordDate()).thenReturn(LocalDate.of(2026, 10, 28));
        when(diary.getEmotion()).thenReturn(Emotion.CALM);
        when(diaryRepository.findById(10L)).thenReturn(Optional.of(diary));
        dispatcher = dispatcherWith(sent::add, "https://cdn.test/mozzi.webp");
    }

    @Test
    void sendsEverythingTheAiServerNeedsInEnglish() {
        stored(DiaryImage.request(10L, new DiaryImage.Selection(TimeOfDay.EVENING, Weather.RAINY, "우리집", "엄마", "요리")));

        dispatcher.dispatch(new ImageGenerationRequestedEvent(10L));

        assertThat(translated).containsExactly(new PromptTranslator.Source("우리집", "엄마", "요리"));
        assertThat(sent).containsExactly(new ImageRequestPublisher.Message(
                10L, 12L, "2026-10-28", "CALM", "https://cdn.test/mozzi.webp", "a round mochi",
                "in the evening", "on a rainy day", "EN(우리집)", "EN(엄마)", "EN(요리)", false));
    }

    @Test
    void aTestApiRequestIsMarkedForTheAiServer() {
        stored(DiaryImage.request(10L, new DiaryImage.Selection(null, null, null, null, "요리")));

        dispatcher.dispatch(new ImageGenerationRequestedEvent(10L, true));

        assertThat(sent.get(0).test()).isTrue();
    }

    @Test
    void optionalPicksGoOutEmpty() {
        stored(DiaryImage.request(10L, new DiaryImage.Selection(null, null, null, null, "요리")));

        dispatcher.dispatch(new ImageGenerationRequestedEvent(10L));

        assertThat(sent.get(0).timeOfDay()).isEmpty();
        assertThat(sent.get(0).weather()).isEmpty();
        assertThat(sent.get(0).where()).isEmpty();
        assertThat(sent.get(0).who()).isEmpty();
    }

    /** The character image is not set up yet; the request still goes out. */
    @Test
    void anUnsetCharacterImageGoesOutAsDefault() {
        stored(DiaryImage.request(10L, new DiaryImage.Selection(null, null, null, null, "요리")));
        dispatcher = dispatcherWith(sent::add, "");

        dispatcher.dispatch(new ImageGenerationRequestedEvent(10L));

        assertThat(sent.get(0).characterImageUrl()).isEqualTo("DEFAULT");
        // The AI server draws its default character from its own description.
        assertThat(sent.get(0).characterPrompt()).isEmpty();
    }

    /** The member's mozzi for the emotion replaces the default character, with its look. */
    @Test
    void theMembersMozziIsDrawnWithItsPrompt() {
        when(cardRepository.findById(30L)).thenReturn(Optional.of(MozziCard.register(
                "S1-01-02", "S1", "달토끼 모찌", CardTier.LEGENDARY, Emotion.CALM,
                "GACHA/S1-01-02_mozzi_legendary_001_calm.png", "wearing a navy star cape")));
        stored(DiaryImage.request(10L, new DiaryImage.Selection(30L, null, null, null, null, "요리")));

        dispatcher.dispatch(new ImageGenerationRequestedEvent(10L));

        assertThat(sent.get(0).characterImageUrl())
                .isEqualTo("https://s3.test/GACHA/S1-01-02_mozzi_legendary_001_calm.png");
        assertThat(sent.get(0).characterPrompt()).isEqualTo("wearing a navy star cape");
    }

    /** A basic mozzi goes out as the default character, the same as no pick. */
    @Test
    void aBasicMozziIsDrawnAsTheDefaultCharacter() {
        when(cardRepository.findById(31L)).thenReturn(Optional.of(MozziCard.register(
                "BASIC-02", "BASIC", "기본 모찌 (평온)", CardTier.NONE, Emotion.CALM, "basic/calm.png", null)));
        stored(DiaryImage.request(10L, new DiaryImage.Selection(31L, null, null, null, null, "요리")));

        dispatcher.dispatch(new ImageGenerationRequestedEvent(10L));

        assertThat(sent.get(0).characterImageUrl()).isEqualTo("https://cdn.test/mozzi.webp");
        assertThat(sent.get(0).characterPrompt()).isEqualTo("a round mochi");
    }

    @Test
    void aRequestNoLongerPendingIsNotSent() {
        DiaryImage image = DiaryImage.request(10L, new DiaryImage.Selection(null, null, null, null, "요리"));
        image.succeed("https://cdn.test/done.webp");
        stored(image);

        dispatcher.dispatch(new ImageGenerationRequestedEvent(10L));

        assertThat(sent).isEmpty();
        verify(resultService, never()).abandon(any());
    }

    @Test
    void aFailedHandOverIsGivenUpWithoutCountingAgainstTheMember() {
        stored(DiaryImage.request(10L, new DiaryImage.Selection(null, null, null, null, "요리")));
        dispatcher = dispatcherWith(message -> {
            throw new IllegalStateException("queue down");
        }, "https://cdn.test/mozzi.webp");

        dispatcher.dispatch(new ImageGenerationRequestedEvent(10L));

        verify(resultService).abandon(10L);
        verify(resultService, never()).fail(any(), any());
    }

    /** The picks never reach the AI server, and the try is used up. */
    @Test
    void blockedPicksAreRejectedAndNotSent() {
        stored(DiaryImage.request(10L, new DiaryImage.Selection(null, null, null, null, "요리")));
        dispatcher = new ImageRequestDispatcher(
                diaryRepository, imageRepository, cardRepository,
                source -> {
                    throw new InappropriatePromptException();
                },
                sent::add, resultService,
                new ImageProperties("", "a round mochi", true),
                new GachaProperties("https://s3.test"),
                mock(PlatformTransactionManager.class));

        dispatcher.dispatch(new ImageGenerationRequestedEvent(10L));

        assertThat(sent).isEmpty();
        verify(resultService).reject(10L);
        verify(resultService, never()).abandon(any());
    }

    private void stored(DiaryImage image) {
        when(imageRepository.findByDiaryId(10L)).thenReturn(Optional.of(image));
    }

    private ImageRequestDispatcher dispatcherWith(ImageRequestPublisher publisher, String characterImageUrl) {
        PromptTranslator translator = source -> {
            translated.add(source);
            return new PromptTranslator.Translation(en(source.where()), en(source.who()), en(source.what()));
        };
        return new ImageRequestDispatcher(
                diaryRepository, imageRepository, cardRepository, translator, publisher, resultService,
                new ImageProperties(characterImageUrl, "a round mochi", true),
                new GachaProperties("https://s3.test"),
                mock(PlatformTransactionManager.class));
    }

    private static String en(String korean) {
        return korean == null ? null : "EN(" + korean + ")";
    }

}
