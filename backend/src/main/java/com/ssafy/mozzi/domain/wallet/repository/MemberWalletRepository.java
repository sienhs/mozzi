package com.ssafy.mozzi.domain.wallet.repository;

import java.util.Optional;
import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.mozzi.domain.wallet.entity.MemberWallet;

public interface MemberWalletRepository extends JpaRepository<MemberWallet, Long> {

    /** Every balance change starts here, so one member's draws, exchanges and rewards run one at a time. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select w from MemberWallet w where w.memberId = :memberId")
    Optional<MemberWallet> findForUpdate(@Param("memberId") Long memberId);

    @Modifying
    @Query("delete from MemberWallet w where w.memberId = :memberId")
    int deleteByMember(@Param("memberId") Long memberId);

}
