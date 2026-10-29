package com.ssafy.mozzi.domain.gacha.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.mozzi.domain.gacha.entity.GachaDraw;

public interface GachaDrawRepository extends JpaRepository<GachaDraw, Long> {

    /** Withdrawal. Run after {@link GachaDrawResultRepository#deleteByMember}. */
    @Modifying
    @Query("delete from GachaDraw d where d.memberId = :memberId")
    int deleteByMember(@Param("memberId") Long memberId);

}
