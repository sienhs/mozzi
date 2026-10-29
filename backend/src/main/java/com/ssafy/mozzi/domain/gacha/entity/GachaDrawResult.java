package com.ssafy.mozzi.domain.gacha.entity;

import java.io.Serializable;
import java.util.Objects;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

/** One card of a draw (ERD {@code gacha_draw_result}). */
@Entity
@Table(name = "gacha_draw_result")
@IdClass(GachaDrawResult.Key.class)
public class GachaDrawResult {

    @Id
    @Column(name = "draw_id")
    private Long drawId;

    /** Order drawn, from 1. */
    @Id
    @Column(name = "seq")
    private int seq;

    @Column(name = "card_id", nullable = false)
    private Long cardId;

    /** The card's tier when drawn, kept for rate statistics. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private CardTier tier;

    @Column(name = "first_acquired", nullable = false)
    private boolean firstAcquired;

    @Column(name = "shards_gained", nullable = false)
    private int shardsGained;

    protected GachaDrawResult() {
        // JPA
    }

    public GachaDrawResult(Long drawId, int seq, Long cardId, CardTier tier, boolean firstAcquired,
            int shardsGained) {
        this.drawId = drawId;
        this.seq = seq;
        this.cardId = cardId;
        this.tier = tier;
        this.firstAcquired = firstAcquired;
        this.shardsGained = shardsGained;
    }

    public Long getCardId() {
        return cardId;
    }

    public boolean isFirstAcquired() {
        return firstAcquired;
    }

    public int getShardsGained() {
        return shardsGained;
    }

    /** Composite primary key. */
    public static class Key implements Serializable {

        private Long drawId;
        private int seq;

        protected Key() {
            // JPA
        }

        @Override
        public boolean equals(Object o) {
            return o instanceof Key other && Objects.equals(drawId, other.drawId) && seq == other.seq;
        }

        @Override
        public int hashCode() {
            return Objects.hash(drawId, seq);
        }

    }

}
