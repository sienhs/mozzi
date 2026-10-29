package com.ssafy.mozzi.domain.gacha.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.mozzi.domain.gacha.entity.GachaDrawResult;

public interface GachaDrawResultRepository extends JpaRepository<GachaDrawResult, GachaDrawResult.Key> {

    /** Withdrawal: the results of every draw the member made. */
    @Modifying
    @Query("""
            delete from GachaDrawResult r
            where r.drawId in (select d.id from GachaDraw d where d.memberId = :memberId)
            """)
    int deleteByMember(@Param("memberId") Long memberId);

}
