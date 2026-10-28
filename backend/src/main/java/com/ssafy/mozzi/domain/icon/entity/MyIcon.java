package com.ssafy.mozzi.domain.icon.entity;

import java.time.Clock;
import java.time.OffsetDateTime;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

import org.hibernate.annotations.SQLRestriction;

import com.ssafy.mozzi.global.entity.BaseTimeEntity;

/**
 * An icon a member made from a base {@link Icon} and a name (ERD {@code my_icon}).
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

    /** Every response shows the base image, so reads fetch it together with the icon. */
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "icon_id", nullable = false)
    private Icon icon;

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

    private MyIcon(Long memberId, Icon icon, String name, IconCategory category) {
        this.memberId = memberId;
        this.icon = icon;
        this.name = name;
        this.category = category;
    }

    public static MyIcon create(Long memberId, Icon icon, String name, IconCategory category) {
        return new MyIcon(memberId, icon, name, category);
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

    public Icon getIcon() {
        return icon;
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
