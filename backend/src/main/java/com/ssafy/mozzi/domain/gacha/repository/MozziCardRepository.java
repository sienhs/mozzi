package com.ssafy.mozzi.domain.gacha.repository;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.mozzi.domain.gacha.entity.MozziCard;

public interface MozziCardRepository extends JpaRepository<MozziCard, Long> {

    /**
     * The draw pool and the collection: active cards, basic mozzi left out. A few hundred rows,
     * read whole. Ordered so that a card index means the same card from one read to the next.
     */
    @Query("""
            select c from MozziCard c
            where c.active = true and c.tier <> com.ssafy.mozzi.domain.gacha.entity.CardTier.NONE
            order by c.id
            """)
    List<MozziCard> findDrawable();

    Optional<MozziCard> findByIdAndActiveTrue(Long id);

    /** The size of the collection, as {@link #findDrawable} counts it. */
    @Query("""
            select count(c) from MozziCard c
            where c.active = true and c.tier <> com.ssafy.mozzi.domain.gacha.entity.CardTier.NONE
            """)
    long countDrawable();

    /** Every card's code, active or not, so the seeder skips cards already registered. */
    @Query("select c.code from MozziCard c")
    Set<String> findAllCodes();

    /** The member's active cards, the ones they can pick for an emotion. */
    @Query("""
            select c from MozziCard c, MemberCard mc
            where mc.cardId = c.id and mc.memberId = :memberId and c.active = true
            """)
    List<MozziCard> findActiveOwned(@Param("memberId") Long memberId);

    /** The card if the member owns it and it is active. */
    @Query("""
            select c from MozziCard c, MemberCard mc
            where mc.cardId = c.id and mc.memberId = :memberId and c.id = :cardId and c.active = true
            """)
    Optional<MozziCard> findActiveOwned(@Param("memberId") Long memberId, @Param("cardId") Long cardId);

}
