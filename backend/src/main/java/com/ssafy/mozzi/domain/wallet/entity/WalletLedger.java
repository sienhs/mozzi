package com.ssafy.mozzi.domain.wallet.entity;

import java.time.OffsetDateTime;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * One movement of a balance (ERD {@code wallet_ledger}). A wallet's balance always equals the
 * sum of its rows.
 *
 * <p>Rewards are not saved through this class: they are inserted with
 * {@code on conflict do nothing} against {@code uq_wallet_ledger_reward_key}, see
 * {@code WalletLedgerRepository#insertReward}.
 */
@Entity
@Table(name = "wallet_ledger")
public class WalletLedger {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "wallet_ledger_id")
    private Long id;

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private Currency currency;

    @Column(nullable = false)
    private int amount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private LedgerReason reason;

    /** The draw, diary or card the movement came from; see the ERD table. */
    @Column(name = "ref_id")
    private Long refId;

    @Column(name = "reward_key", length = 40)
    private String rewardKey;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    protected WalletLedger() {
        // JPA
    }

    private WalletLedger(Long memberId, Currency currency, int amount, LedgerReason reason, Long refId,
            OffsetDateTime createdAt) {
        this.memberId = memberId;
        this.currency = currency;
        this.amount = amount;
        this.reason = reason;
        this.refId = refId;
        this.createdAt = createdAt;
    }

    /** A movement tied to a draw or a card; {@code uq_wallet_ledger_ref} keeps it to one row. */
    public static WalletLedger of(Long memberId, Currency currency, int amount, LedgerReason reason, Long refId,
            OffsetDateTime now) {
        return new WalletLedger(memberId, currency, amount, reason, refId, now);
    }

    public Long getId() {
        return id;
    }

    public Long getMemberId() {
        return memberId;
    }

    public Currency getCurrency() {
        return currency;
    }

    public int getAmount() {
        return amount;
    }

    public LedgerReason getReason() {
        return reason;
    }

    public Long getRefId() {
        return refId;
    }

    public String getRewardKey() {
        return rewardKey;
    }

}
