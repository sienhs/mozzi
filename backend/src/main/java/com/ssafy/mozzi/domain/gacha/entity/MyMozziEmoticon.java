package com.ssafy.mozzi.domain.gacha.entity;

import java.io.Serializable;
import java.time.OffsetDateTime;
import java.util.Objects;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.IdClass;
import jakarta.persistence.Table;

import com.ssafy.mozzi.domain.diary.entity.Emotion;

/**
 * The mozzi a member picked for one emotion (ERD {@code my_mozzi_emoticon}): shown on the
 * my page and drawn into that emotion's pictures. One row per member and emotion.
 */
@Entity
@Table(name = "my_mozzi_emoticon")
@IdClass(MyMozziEmoticon.Key.class)
public class MyMozziEmoticon {

    @Id
    @Column(name = "member_id")
    private Long memberId;

    @Id
    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private Emotion emotion;

    @Column(name = "card_id", nullable = false)
    private Long cardId;

    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    protected MyMozziEmoticon() {
        // JPA
    }

    public static MyMozziEmoticon pick(Long memberId, Emotion emotion, Long cardId, OffsetDateTime now) {
        MyMozziEmoticon row = new MyMozziEmoticon();
        row.memberId = memberId;
        row.emotion = emotion;
        row.change(cardId, now);
        return row;
    }

    public void change(Long cardId, OffsetDateTime now) {
        this.cardId = cardId;
        this.updatedAt = now;
    }

    public Long getMemberId() {
        return memberId;
    }

    public Emotion getEmotion() {
        return emotion;
    }

    public Long getCardId() {
        return cardId;
    }

    public static class Key implements Serializable {

        private Long memberId;
        private Emotion emotion;

        protected Key() {
            // JPA
        }

        public Key(Long memberId, Emotion emotion) {
            this.memberId = memberId;
            this.emotion = emotion;
        }

        @Override
        public boolean equals(Object o) {
            return o instanceof Key other && Objects.equals(memberId, other.memberId) && emotion == other.emotion;
        }

        @Override
        public int hashCode() {
            return Objects.hash(memberId, emotion);
        }

    }

}
