package com.ssafy.mozzi.domain.gacha.repository;

import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.mozzi.domain.gacha.entity.MemberCard;

public interface MemberCardRepository extends JpaRepository<MemberCard, MemberCard.Key> {

    List<MemberCard> findByMemberId(Long memberId);

    boolean existsByMemberIdAndCardId(Long memberId, Long cardId);

    /** Owned cards that are still active: the "owned" of the collection's progress. */
    @Query("""
            select count(mc) from MemberCard mc, MozziCard c
            where c.id = mc.cardId and mc.memberId = :memberId and c.active = true
            """)
    long countActiveOwned(@Param("memberId") Long memberId);

    /** Clears the NEW mark. Cards the member does not have are skipped, not refused. */
    @Modifying
    @Query("""
            update MemberCard mc set mc.seenAt = :now
            where mc.memberId = :memberId and mc.cardId in :cardIds and mc.seenAt is null
            """)
    int markSeen(@Param("memberId") Long memberId, @Param("cardIds") Collection<Long> cardIds,
            @Param("now") OffsetDateTime now);

    @Modifying
    @Query("delete from MemberCard mc where mc.memberId = :memberId")
    int deleteByMember(@Param("memberId") Long memberId);

}
