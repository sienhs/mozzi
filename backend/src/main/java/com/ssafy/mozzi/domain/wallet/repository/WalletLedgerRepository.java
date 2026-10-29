package com.ssafy.mozzi.domain.wallet.repository;

import java.time.OffsetDateTime;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.mozzi.domain.wallet.entity.WalletLedger;

public interface WalletLedgerRepository extends JpaRepository<WalletLedger, Long> {

    /**
     * Records a ticket reward unless the member already has its key.
     *
     * @return 1 when the reward is new and must be paid, 0 when it was already paid
     */
    @Modifying
    @Query(value = """
            insert into wallet_ledger (member_id, currency, amount, reason, ref_id, reward_key, created_at)
            values (:memberId, 'TICKET', :amount, :reason, :refId, :rewardKey, :now)
            on conflict (member_id, reward_key) where reward_key is not null do nothing
            """, nativeQuery = true)
    int insertReward(
            @Param("memberId") Long memberId,
            @Param("amount") int amount,
            @Param("reason") String reason,
            @Param("refId") Long refId,
            @Param("rewardKey") String rewardKey,
            @Param("now") OffsetDateTime now);

    @Modifying
    @Query("delete from WalletLedger l where l.memberId = :memberId")
    int deleteByMember(@Param("memberId") Long memberId);

}
