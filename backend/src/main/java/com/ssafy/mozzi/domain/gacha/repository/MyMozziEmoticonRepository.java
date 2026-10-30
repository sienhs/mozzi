package com.ssafy.mozzi.domain.gacha.repository;

import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.mozzi.domain.gacha.entity.MyMozziEmoticon;

public interface MyMozziEmoticonRepository extends JpaRepository<MyMozziEmoticon, MyMozziEmoticon.Key> {

    List<MyMozziEmoticon> findByMemberId(Long memberId);

    /**
     * Picks each emotion's basic mozzi where the member has picked nothing yet; an earlier pick
     * stays.
     */
    @Modifying
    @Query(nativeQuery = true, value = """
            insert into my_mozzi_emoticon (member_id, emotion, card_id, updated_at)
            select :memberId, c.emotion, c.card_id, :now
            from mozzi_card c
            where c.tier = 'NONE' and c.is_active
            on conflict (member_id, emotion) do nothing
            """)
    int pickBasic(@Param("memberId") Long memberId, @Param("now") OffsetDateTime now);

    @Modifying
    @Query("delete from MyMozziEmoticon m where m.memberId = :memberId")
    int deleteByMember(@Param("memberId") Long memberId);

}
