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

    /** Owned cards that are still active, basic mozzi left out: the "owned" of the collection's progress. */
    @Query("""
            select count(mc) from MemberCard mc, MozziCard c
            where c.id = mc.cardId and mc.memberId = :memberId and c.active = true
              and c.tier <> com.ssafy.mozzi.domain.gacha.entity.CardTier.NONE
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

    /**
     * Gives the member every active basic mozzi they lack. Marked seen at once: a gift is not
     * NEW. Running it again changes nothing.
     */
    @Modifying
    @Query(nativeQuery = true, value = """
            insert into member_card (member_id, card_id, owned_count, first_acquired_at, seen_at)
            select :memberId, c.card_id, 1, :now, :now
            from mozzi_card c
            where c.tier = 'NONE' and c.is_active
            on conflict (member_id, card_id) do nothing
            """)
    int grantBasic(@Param("memberId") Long memberId, @Param("now") OffsetDateTime now);

    /** Members, withdrawn ones aside, who lack an active basic mozzi. */
    @Query(nativeQuery = true, value = """
            select m.member_id from member m
            where m.deleted_at is null and exists (
                select 1 from mozzi_card c
                where c.tier = 'NONE' and c.is_active and not exists (
                    select 1 from member_card mc where mc.member_id = m.member_id and mc.card_id = c.card_id))
            """)
    List<Long> findMembersLackingBasic();

    @Modifying
    @Query("delete from MemberCard mc where mc.memberId = :memberId")
    int deleteByMember(@Param("memberId") Long memberId);

}
