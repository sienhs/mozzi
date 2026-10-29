package com.ssafy.mozzi.domain.gacha.entity;

import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.Objects;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import org.hibernate.annotations.DynamicUpdate;

/**
 * A card in a member's collection (ERD {@code member_card}). The primary key is the last line
 * against the same card being added twice.
 *
 * <p>Draws and the NEW mark write different columns of the same row, and only draws take the
 * wallet lock. {@link DynamicUpdate} keeps a draw's update to {@code owned_count}, so a draw
 * that read the card before it was marked seen cannot write the stale {@code seen_at} back.
 */
@Entity
@Table(name = "member_card")
@IdClass(MemberCard.Key.class)
@DynamicUpdate
public class MemberCard {

    @Id
    @Column(name = "member_id")
    private Long memberId;

    @Id
    @Column(name = "card_id")
    private Long cardId;

    /** Times obtained through draws and exchanges, duplicates included. */
    @Column(name = "owned_count", nullable = false)
    private int ownedCount;

    @Column(name = "first_acquired_at", nullable = false)
    private OffsetDateTime firstAcquiredAt;

    /** {@code null} until the member opens it in the collection: the NEW mark. */
    @Column(name = "seen_at")
    private OffsetDateTime seenAt;

    protected MemberCard() {
        // JPA
    }

    private MemberCard(Long memberId, Long cardId, OffsetDateTime now) {
        this.memberId = memberId;
        this.cardId = cardId;
        this.ownedCount = 1;
        this.firstAcquiredAt = now;
    }

    public static MemberCard acquire(Long memberId, Long cardId, OffsetDateTime now) {
        return new MemberCard(memberId, cardId, now);
    }

    public void acquireAgain() {
        ownedCount++;
    }

    public Long getMemberId() {
        return memberId;
    }

    public Long getCardId() {
        return cardId;
    }

    public int getOwnedCount() {
        return ownedCount;
    }

    public OffsetDateTime getSeenAt() {
        return seenAt;
    }

    public boolean isNew() {
        return seenAt == null;
    }

    /** Composite primary key. */
    public static class Key implements Serializable {

        private Long memberId;
        private Long cardId;

        protected Key() {
            // JPA
        }

        public Key(Long memberId, Long cardId) {
            this.memberId = memberId;
            this.cardId = cardId;
        }

        @Override
        public boolean equals(Object o) {
            return o instanceof Key other && Objects.equals(memberId, other.memberId)
                    && Objects.equals(cardId, other.cardId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(memberId, cardId);
        }

    }

}
