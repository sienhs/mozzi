package com.ssafy.mozzi.domain.gacha.service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.gacha.dto.MyMozziCardResponseDto;
import com.ssafy.mozzi.domain.gacha.dto.MyMozziResponseDto;
import com.ssafy.mozzi.domain.gacha.dto.MyMozziSearchRequestDto;
import com.ssafy.mozzi.domain.gacha.dto.OwnedMozziListResponseDto;
import com.ssafy.mozzi.domain.gacha.dto.OwnedMozziResponseDto;
import com.ssafy.mozzi.domain.gacha.entity.MemberCard;
import com.ssafy.mozzi.domain.gacha.entity.MozziCard;
import com.ssafy.mozzi.domain.gacha.entity.MyMozziEmoticon;
import com.ssafy.mozzi.domain.gacha.exception.GachaErrorCode;
import com.ssafy.mozzi.domain.gacha.repository.MemberCardRepository;
import com.ssafy.mozzi.domain.gacha.repository.MozziCardRepository;
import com.ssafy.mozzi.domain.gacha.repository.MyMozziEmoticonRepository;
import com.ssafy.mozzi.global.exception.BusinessException;

/**
 * The mozzi a member picked for each emotion: listed on the my page, changed there, and drawn
 * into the pictures of diaries with that emotion.
 */
@Service
public class MyMozziService {

    private final MyMozziEmoticonRepository myMozziRepository;
    private final MozziCardRepository cardRepository;
    private final MemberCardRepository memberCardRepository;
    private final GachaProperties properties;
    private final Clock clock;

    public MyMozziService(MyMozziEmoticonRepository myMozziRepository, MozziCardRepository cardRepository,
            MemberCardRepository memberCardRepository, GachaProperties properties, Clock clock) {
        this.myMozziRepository = myMozziRepository;
        this.cardRepository = cardRepository;
        this.memberCardRepository = memberCardRepository;
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * Every emotion in order, with its pick. A pick whose card is no longer active shows as
     * none. The cards to pick from come from {@link #search}.
     */
    @Transactional(readOnly = true)
    public List<MyMozziResponseDto> list(Long memberId) {
        Map<Emotion, Long> picks = myMozziRepository.findByMemberId(memberId).stream()
                .collect(Collectors.toMap(MyMozziEmoticon::getEmotion, MyMozziEmoticon::getCardId));
        Map<Long, MozziCard> picked = cardRepository.findAllById(picks.values()).stream()
                .filter(MozziCard::isActive)
                .collect(Collectors.toMap(MozziCard::getId, Function.identity()));

        return List.of(Emotion.values()).stream()
                .map(emotion -> {
                    MozziCard selected = picked.get(picks.get(emotion));
                    return new MyMozziResponseDto(emotion, selected == null ? null : toDto(selected));
                })
                .toList();
    }

    /**
     * The owned mozzi screen: the member's active cards, filtered and sorted. Ties, such as
     * cards obtained in the same draw, keep code order: the cards are put in it first and the
     * sort is stable.
     */
    @Transactional(readOnly = true)
    public OwnedMozziListResponseDto search(Long memberId, MyMozziSearchRequestDto request) {
        Map<Long, OffsetDateTime> acquiredAt = memberCardRepository.findByMemberId(memberId).stream()
                .collect(Collectors.toMap(MemberCard::getCardId, MemberCard::getFirstAcquiredAt));
        Set<Long> equipped = new HashSet<>();
        myMozziRepository.findByMemberId(memberId).forEach(row -> equipped.add(row.getCardId()));
        String name = request.name() == null || request.name().isBlank() ? null : request.name().strip();

        Comparator<OwnedMozziResponseDto> order = switch (request.sortOrDefault()) {
            case RECENT -> Comparator.comparing(OwnedMozziResponseDto::acquiredAt, Comparator.reverseOrder());
            case OLDEST -> Comparator.comparing(OwnedMozziResponseDto::acquiredAt);
            case NAME -> Comparator.comparing(OwnedMozziResponseDto::name);
        };

        List<OwnedMozziResponseDto> cards = cardRepository.findActiveOwned(memberId).stream()
                .filter(card -> request.emotion() == null || card.getEmotion() == request.emotion())
                .filter(card -> request.tier() == null || card.getTier() == request.tier())
                .filter(card -> name == null || card.getName().contains(name))
                .sorted(Comparator.comparing(MozziCard::getCode))
                .map(card -> new OwnedMozziResponseDto(
                        card.getId(),
                        card.getName(),
                        card.getTier(),
                        card.getEmotion(),
                        properties.imageUrl(card.getImageKey()),
                        acquiredAt.get(card.getId()),
                        equipped.contains(card.getId())))
                .sorted(order)
                .toList();
        return new OwnedMozziListResponseDto(cards.size(), cards);
    }

    /** Picks the card for its emotion, replacing an earlier pick. */
    @Transactional
    public void choose(Long memberId, Emotion emotion, Long cardId) {
        MozziCard card = cardRepository.findActiveOwned(memberId, cardId)
                .orElseThrow(() -> new BusinessException(GachaErrorCode.CARD_NOT_OWNED,
                        "card " + cardId + " not owned or inactive: memberId=" + memberId));
        if (card.getEmotion() != emotion) {
            throw new BusinessException(GachaErrorCode.CARD_EMOTION_MISMATCH,
                    "card " + cardId + " is " + card.getEmotion() + ", picked for " + emotion);
        }
        OffsetDateTime now = OffsetDateTime.now(clock);
        myMozziRepository.findById(new MyMozziEmoticon.Key(memberId, emotion))
                .ifPresentOrElse(
                        row -> row.change(cardId, now),
                        () -> myMozziRepository.save(MyMozziEmoticon.pick(memberId, emotion, cardId, now)));
    }

    /**
     * Gives the member the basic mozzi and picks each for its emotion where nothing is picked
     * yet. Safe to repeat. Runs in the caller's transaction: sign-up, or
     * {@link BasicMozziBackfill} at start-up.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void grantBasic(Long memberId) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        memberCardRepository.grantBasic(memberId, now);
        myMozziRepository.pickBasic(memberId, now);
    }

    /** The card to draw into a picture of this emotion: the pick, while still active and owned. */
    @Transactional(readOnly = true)
    public Optional<Long> cardFor(Long memberId, Emotion emotion) {
        return myMozziRepository.findById(new MyMozziEmoticon.Key(memberId, emotion))
                .flatMap(row -> cardRepository.findActiveOwned(memberId, row.getCardId()))
                .map(MozziCard::getId);
    }

    private MyMozziCardResponseDto toDto(MozziCard card) {
        return new MyMozziCardResponseDto(
                card.getId(), card.getName(), card.getTier(), properties.imageUrl(card.getImageKey()));
    }

}
