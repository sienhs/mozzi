package com.ssafy.mozzi.domain.gacha.service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.mozzi.domain.gacha.dto.CollectionProgressDto;
import com.ssafy.mozzi.domain.gacha.dto.GachaDrawRequestDto;
import com.ssafy.mozzi.domain.gacha.dto.GachaDrawResponseDto;
import com.ssafy.mozzi.domain.gacha.dto.GachaExchangeRequestDto;
import com.ssafy.mozzi.domain.gacha.dto.GachaExchangeResponseDto;
import com.ssafy.mozzi.domain.gacha.entity.CardTier;
import com.ssafy.mozzi.domain.gacha.entity.GachaDraw;
import com.ssafy.mozzi.domain.gacha.entity.GachaDrawResult;
import com.ssafy.mozzi.domain.gacha.entity.MemberCard;
import com.ssafy.mozzi.domain.gacha.entity.MozziCard;
import com.ssafy.mozzi.domain.gacha.exception.GachaErrorCode;
import com.ssafy.mozzi.domain.gacha.repository.GachaDrawRepository;
import com.ssafy.mozzi.domain.gacha.repository.GachaDrawResultRepository;
import com.ssafy.mozzi.domain.gacha.repository.MemberCardRepository;
import com.ssafy.mozzi.domain.gacha.repository.MozziCardRepository;
import com.ssafy.mozzi.domain.wallet.entity.Currency;
import com.ssafy.mozzi.domain.wallet.entity.LedgerReason;
import com.ssafy.mozzi.domain.wallet.entity.MemberWallet;
import com.ssafy.mozzi.domain.wallet.service.WalletService;
import com.ssafy.mozzi.global.exception.BusinessException;
import com.ssafy.mozzi.global.exception.CommonErrorCode;
import com.ssafy.mozzi.global.idempotency.IdempotencyStore;

/**
 * Draws and exchanges: everything that spends from the wallet.
 *
 * <p>Each runs in one transaction that starts with its idempotency record and then locks the
 * member's wallet, so one member's draws and exchanges run one after another and see each
 * other's cards. The server only decides the results; how they are revealed is up to the app.
 */
@Service
public class GachaService {

    static final String DRAW_ENDPOINT = "POST /gacha/draws";
    static final String EXCHANGE_ENDPOINT = "POST /gacha/exchanges";

    private final MozziCardRepository cardRepository;
    private final MemberCardRepository memberCardRepository;
    private final GachaDrawRepository drawRepository;
    private final GachaDrawResultRepository drawResultRepository;
    private final WalletService walletService;
    private final IdempotencyStore idempotencyStore;
    private final GachaTierCatalog tierCatalog;
    private final CardMapper cardMapper;
    private final RandomSource random;
    private final Clock clock;

    public GachaService(
            MozziCardRepository cardRepository,
            MemberCardRepository memberCardRepository,
            GachaDrawRepository drawRepository,
            GachaDrawResultRepository drawResultRepository,
            WalletService walletService,
            IdempotencyStore idempotencyStore,
            GachaTierCatalog tierCatalog,
            CardMapper cardMapper,
            RandomSource random,
            Clock clock) {
        this.cardRepository = cardRepository;
        this.memberCardRepository = memberCardRepository;
        this.drawRepository = drawRepository;
        this.drawResultRepository = drawResultRepository;
        this.walletService = walletService;
        this.idempotencyStore = idempotencyStore;
        this.tierCatalog = tierCatalog;
        this.cardMapper = cardMapper;
        this.random = random;
        this.clock = clock;
    }

    /**
     * Spends {@code count} tickets on as many cards.
     *
     * @throws BusinessException {@code 409 NOT_ENOUGH_TICKETS}, or {@code 503 GACHA_UNAVAILABLE}
     *                           when a drawn tier has no active card; either way nothing is spent
     */
    @Transactional
    public GachaDrawResponseDto draw(Long memberId, String idempotencyKey, GachaDrawRequestDto request) {
        return idempotencyStore.run(memberId, DRAW_ENDPOINT, idempotencyKey, request, HttpStatus.CREATED.value(),
                GachaDrawResponseDto.class, () -> doDraw(memberId, request.count()));
    }

    private GachaDrawResponseDto doDraw(Long memberId, int count) {
        MemberWallet wallet = walletService.lock(memberId);
        if (wallet.getTicketBalance() < count) {
            throw new BusinessException(GachaErrorCode.NOT_ENOUGH_TICKETS,
                    "has " + wallet.getTicketBalance() + ", asked " + count);
        }
        OffsetDateTime now = OffsetDateTime.now(clock);
        Map<CardTier, List<MozziCard>> pool = activeCardsByTier();
        // The member's cards, keyed by card id. Cards drawn below join it at once, so a second
        // copy within the same request already counts as a duplicate.
        Map<Long, MemberCard> owned = memberCardRepository.findByMemberId(memberId).stream()
                .collect(Collectors.toMap(MemberCard::getCardId, Function.identity()));

        List<Pick> picks = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            MozziCard card = pick(pool, owned);
            MemberCard copy = owned.get(card.getId());
            if (copy == null) {
                owned.put(card.getId(), memberCardRepository.save(MemberCard.acquire(memberId, card.getId(), now)));
                picks.add(new Pick(card, true, 0));
            } else {
                copy.acquireAgain();
                picks.add(new Pick(card, false, tierCatalog.get(card.getTier()).getDuplicateShards()));
            }
        }

        GachaDraw draw = drawRepository.save(new GachaDraw(memberId, count, now));
        for (int i = 0; i < picks.size(); i++) {
            Pick pick = picks.get(i);
            drawResultRepository.save(new GachaDrawResult(draw.getId(), i + 1, pick.card().getId(),
                    pick.card().getTier(), pick.firstAcquired(), pick.shardsGained()));
        }

        walletService.apply(wallet, Currency.TICKET, -count, LedgerReason.DRAW, draw.getId());
        int shards = picks.stream().mapToInt(Pick::shardsGained).sum();
        if (shards > 0) {
            walletService.apply(wallet, Currency.SHARD, shards, LedgerReason.DUPLICATE, draw.getId());
        }

        // Every result shows the card as it stands after the whole draw.
        List<GachaDrawResponseDto.Result> results = picks.stream()
                .map(pick -> new GachaDrawResponseDto.Result(
                        cardMapper.toDto(pick.card(), owned.get(pick.card().getId())),
                        pick.firstAcquired(), pick.shardsGained()))
                .toList();
        Set<Long> activeIds = pool.values().stream().flatMap(List::stream).map(MozziCard::getId)
                .collect(Collectors.toSet());
        CollectionProgressDto progress = new CollectionProgressDto(
                owned.keySet().stream().filter(activeIds::contains).count(), activeIds.size());
        return new GachaDrawResponseDto(
                draw.getId(), results, wallet.getTicketBalance(), wallet.getShardBalance(), progress);
    }

    /**
     * A tier by weight, then a card of it uniformly. Legendary and mythic narrow to the
     * cards the member lacks while there are any.
     */
    private MozziCard pick(Map<CardTier, List<MozziCard>> pool, Map<Long, MemberCard> owned) {
        CardTier tier = tierCatalog.tierFor(random.nextInt(GachaTierCatalog.TOTAL_WEIGHT));
        List<MozziCard> candidates = pool.getOrDefault(tier, List.of());
        if (candidates.isEmpty()) {
            throw new BusinessException(GachaErrorCode.GACHA_UNAVAILABLE, "no active card in " + tier);
        }
        if (tier.prefersUnowned()) {
            List<MozziCard> unowned = candidates.stream().filter(card -> !owned.containsKey(card.getId())).toList();
            if (!unowned.isEmpty()) {
                candidates = unowned;
            }
        }
        return candidates.get(random.nextInt(candidates.size()));
    }

    /**
     * Trades star shards for a legendary or mythic card the member lacks.
     *
     * @throws BusinessException {@code 404 NOT_FOUND} for a missing or inactive card,
     *                           {@code 409 CARD_NOT_EXCHANGEABLE} below legendary,
     *                           {@code 409 CARD_ALREADY_OWNED}, {@code 409 NOT_ENOUGH_SHARDS}
     */
    @Transactional
    public GachaExchangeResponseDto exchange(Long memberId, String idempotencyKey, GachaExchangeRequestDto request) {
        return idempotencyStore.run(memberId, EXCHANGE_ENDPOINT, idempotencyKey, request, HttpStatus.CREATED.value(),
                GachaExchangeResponseDto.class, () -> doExchange(memberId, request.cardId()));
    }

    private GachaExchangeResponseDto doExchange(Long memberId, Long cardId) {
        MemberWallet wallet = walletService.lock(memberId);
        MozziCard card = cardRepository.findByIdAndActiveTrue(cardId)
                .orElseThrow(() -> new BusinessException(CommonErrorCode.NOT_FOUND, "card " + cardId));
        Integer cost = tierCatalog.get(card.getTier()).getExchangeCost();
        if (cost == null) {
            throw new BusinessException(GachaErrorCode.CARD_NOT_EXCHANGEABLE, card.getTier() + " card " + cardId);
        }
        if (memberCardRepository.existsByMemberIdAndCardId(memberId, cardId)) {
            throw new BusinessException(GachaErrorCode.CARD_ALREADY_OWNED, "card " + cardId);
        }
        if (wallet.getShardBalance() < cost) {
            throw new BusinessException(GachaErrorCode.NOT_ENOUGH_SHARDS,
                    "has " + wallet.getShardBalance() + ", costs " + cost);
        }

        MemberCard copy = memberCardRepository.save(MemberCard.acquire(memberId, cardId, OffsetDateTime.now(clock)));
        walletService.apply(wallet, Currency.SHARD, -cost, LedgerReason.EXCHANGE, cardId);
        return new GachaExchangeResponseDto(cardMapper.toDto(card, copy), cost, wallet.getShardBalance());
    }

    private Map<CardTier, List<MozziCard>> activeCardsByTier() {
        Map<CardTier, List<MozziCard>> byTier = new EnumMap<>(CardTier.class);
        for (MozziCard card : cardRepository.findByActiveTrueOrderByIdAsc()) {
            byTier.computeIfAbsent(card.getTier(), tier -> new ArrayList<>()).add(card);
        }
        return byTier;
    }

    private record Pick(MozziCard card, boolean firstAcquired, int shardsGained) {
    }

}
