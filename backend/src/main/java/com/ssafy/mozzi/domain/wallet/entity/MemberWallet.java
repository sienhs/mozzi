package com.ssafy.mozzi.domain.wallet.entity;

import java.time.OffsetDateTime;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * A member's tickets and star shards (ERD {@code member_wallet}), one row per member.
 *
 * <p>Every change goes through {@code WalletService}, which locks this row and writes a
 * {@link WalletLedger} row in the same transaction. The lock is what serialises one member's
 * draws, exchanges and rewards; the check constraints are the last line against a negative
 * balance.
 */
@Entity
@Table(name = "member_wallet")
public class MemberWallet {

    @Id
    @Column(name = "member_id")
    private Long memberId;

    @Column(name = "ticket_balance", nullable = false)
    private int ticketBalance;

    @Column(name = "shard_balance", nullable = false)
    private int shardBalance;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected MemberWallet() {
        // JPA
    }

    private MemberWallet(Long memberId, OffsetDateTime now) {
        this.memberId = memberId;
        this.updatedAt = now;
    }

    /** An empty wallet; the sign-up reward is then paid into it like any other. */
    public static MemberWallet open(Long memberId, OffsetDateTime now) {
        return new MemberWallet(memberId, now);
    }

    /**
     * @param amount positive to add, negative to spend
     * @throws IllegalStateException when the balance would go negative; callers check first
     */
    public void change(Currency currency, int amount, OffsetDateTime now) {
        switch (currency) {
            case TICKET -> ticketBalance = requireNotNegative(ticketBalance + amount, currency);
            case SHARD -> shardBalance = requireNotNegative(shardBalance + amount, currency);
        }
        updatedAt = now;
    }

    private static int requireNotNegative(int balance, Currency currency) {
        if (balance < 0) {
            throw new IllegalStateException(currency + " balance would go negative: " + balance);
        }
        return balance;
    }

    public Long getMemberId() {
        return memberId;
    }

    public int getTicketBalance() {
        return ticketBalance;
    }

    public int getShardBalance() {
        return shardBalance;
    }

}
