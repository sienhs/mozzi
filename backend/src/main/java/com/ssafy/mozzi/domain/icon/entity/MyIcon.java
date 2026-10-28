package com.ssafy.mozzi.domain.icon.entity;

import java.time.Clock;
import java.time.OffsetDateTime;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import org.hibernate.annotations.SQLRestriction;

import com.ssafy.mozzi.global.entity.BaseTimeEntity;

/**
 * A word a member made under a category (ERD {@code my_icon}): text only, with no image.
 *
 * <p>Deleting is soft. {@link SQLRestriction} keeps deleted icons out of every read,
 * including a diary's icons loaded through {@code diary_icon}, so a deleted icon disappears
 * from old diaries too, as the spec asks.
 */
@Entity
@Table(name = "my_icon")
@SQLRestriction("deleted_at is null")
public class MyIcon extends BaseTimeEntity {

    /** Per category, deleted icons not counted. */
    public static final int MAX_PER_CATEGORY = 9;
    public static final int NAME_MAX_LENGTH = 10;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "my_icon_id")
    private Long id;

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Column(nullable = false, length = NAME_MAX_LENGTH)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 10)
    private IconCategory category;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    protected MyIcon() {
        // JPA
    }

    private MyIcon(Long memberId, String name, IconCategory category) {
        this.memberId = memberId;
        this.name = name;
        this.category = category;
    }

    public static MyIcon create(Long memberId, String name, IconCategory category) {
        return new MyIcon(memberId, name, category);
    }

    public void delete(Clock clock) {
        this.deletedAt = OffsetDateTime.now(clock);
    }

    public Long getId() {
        return id;
    }

    public Long getMemberId() {
        return memberId;
    }

    public String getName() {
        return name;
    }

    public IconCategory getCategory() {
        return category;
    }

    public OffsetDateTime getDeletedAt() {
        return deletedAt;
    }

}
