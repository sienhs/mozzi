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
     * The draw pool and the collection. A hundred or so rows, read whole. Ordered so that a
     * card index means the same card from one read to the next.
     */
    List<MozziCard> findByActiveTrueOrderByIdAsc();

    Optional<MozziCard> findByIdAndActiveTrue(Long id);

    long countByActiveTrue();

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
