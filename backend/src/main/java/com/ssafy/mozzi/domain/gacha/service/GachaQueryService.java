package com.ssafy.mozzi.domain.gacha.service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.mozzi.domain.gacha.dto.CardResponseDto;
import com.ssafy.mozzi.domain.gacha.dto.CollectionProgressDto;
import com.ssafy.mozzi.domain.gacha.dto.GachaCollectionRequestDto;
import com.ssafy.mozzi.domain.gacha.dto.GachaCollectionResponseDto;
import com.ssafy.mozzi.domain.gacha.dto.GachaRatesResponseDto;
import com.ssafy.mozzi.domain.gacha.dto.GachaStatusResponseDto;
import com.ssafy.mozzi.domain.gacha.entity.MemberCard;
import com.ssafy.mozzi.domain.gacha.entity.MozziCard;
import com.ssafy.mozzi.domain.gacha.repository.MemberCardRepository;
import com.ssafy.mozzi.domain.gacha.repository.MozziCardRepository;
import com.ssafy.mozzi.domain.wallet.entity.MemberWallet;
import com.ssafy.mozzi.domain.wallet.service.WalletService;

/** The gacha screens' reads, and clearing the collection's NEW marks. */
@Service
public class GachaQueryService {

    /** Rarest tier first, then by code. */
    private static final Comparator<MozziCard> COLLECTION_ORDER =
            Comparator.comparing(MozziCard::getTier).reversed().thenComparing(MozziCard::getCode);

    private final MozziCardRepository cardRepository;
    private final MemberCardRepository memberCardRepository;
    private final WalletService walletService;
    private final GachaTierCatalog tierCatalog;
    private final CardMapper cardMapper;
    private final Clock clock;

    public GachaQueryService(MozziCardRepository cardRepository, MemberCardRepository memberCardRepository,
            WalletService walletService, GachaTierCatalog tierCatalog, CardMapper cardMapper,
            Clock clock) {
        this.cardRepository = cardRepository;
        this.memberCardRepository = memberCardRepository;
        this.walletService = walletService;
        this.tierCatalog = tierCatalog;
        this.cardMapper = cardMapper;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public GachaStatusResponseDto status(Long memberId) {
        MemberWallet wallet = walletService.read(memberId);
        return new GachaStatusResponseDto(wallet.getTicketBalance(), wallet.getShardBalance(), new CollectionProgressDto(
                memberCardRepository.countActiveOwned(memberId), cardRepository.countDrawable()));
    }

    public GachaRatesResponseDto rates() {
        return new GachaRatesResponseDto(tierCatalog.all().stream().map(GachaRatesResponseDto.Rate::from).toList());
    }

    /** Every active card, owned or not, with the member's copy where it has one. */
    @Transactional(readOnly = true)
    public GachaCollectionResponseDto collection(Long memberId, GachaCollectionRequestDto request) {
        List<MozziCard> cards = cardRepository.findDrawable();
        Map<Long, MemberCard> owned = memberCardRepository.findByMemberId(memberId).stream()
                .collect(Collectors.toMap(MemberCard::getCardId, Function.identity()));
        Set<Long> activeIds = cards.stream().map(MozziCard::getId).collect(Collectors.toSet());
        long ownedCount = owned.keySet().stream().filter(activeIds::contains).count();

        List<CardResponseDto> listed = cards.stream()
                .filter(card -> request.owned() == null || request.owned() == owned.containsKey(card.getId()))
                .filter(card -> request.series() == null || request.series().equals(card.getSeries()))
                .sorted(COLLECTION_ORDER)
                .map(card -> cardMapper.toDto(card, owned.get(card.getId())))
                .toList();
        int shardCount = walletService.read(memberId).getShardBalance();
        return new GachaCollectionResponseDto(ownedCount, cards.size(), shardCount, listed);
    }

    /** Clears the NEW mark of the member's cards among {@code cardIds}; other ids are ignored. */
    @Transactional
    public void markSeen(Long memberId, List<Long> cardIds) {
        if (!cardIds.isEmpty()) {
            memberCardRepository.markSeen(memberId, Set.copyOf(cardIds), OffsetDateTime.now(clock));
        }
    }

}
