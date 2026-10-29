package com.ssafy.mozzi.domain.gacha.entity;

import java.time.OffsetDateTime;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** One draw request (ERD {@code gacha_draw}), whatever its count. */
@Entity
@Table(name = "gacha_draw")
public class GachaDraw {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "draw_id")
    private Long id;

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Column(name = "draw_count", nullable = false)
    private int drawCount;

    @Column(name = "created_at", nullable = false)
    private OffsetDateTime createdAt;

    protected GachaDraw() {
        // JPA
    }

    public GachaDraw(Long memberId, int drawCount, OffsetDateTime createdAt) {
        this.memberId = memberId;
        this.drawCount = drawCount;
        this.createdAt = createdAt;
    }

    public Long getId() {
        return id;
    }

    public Long getMemberId() {
        return memberId;
    }

    public int getDrawCount() {
        return drawCount;
    }

}
