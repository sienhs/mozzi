package com.ssafy.mozzi.global.entity;

import java.time.OffsetDateTime;
import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;

import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

/**
 * {@code created_at} and {@code updated_at}, which every table in the ERD carries.
 *
 * <p>{@link OffsetDateTime} maps to {@code timestamptz} and is what the API returns
 * ({@code 2026-10-22T21:12:00+09:00}, spec 1).
 *
 * <p>The timestamps come from the application's {@code Clock} bean, not from the machine
 * clock — see {@link com.ssafy.mozzi.global.config.JpaAuditingConfig}.
 */
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class BaseTimeEntity {

    @CreatedDate
    @Column(name = "created_at", nullable = false, updatable = false)
    private OffsetDateTime createdAt;

    @LastModifiedDate
    @Column(name = "updated_at", nullable = false)
    private OffsetDateTime updatedAt;

    public OffsetDateTime getCreatedAt() {
        return createdAt;
    }

    public OffsetDateTime getUpdatedAt() {
        return updatedAt;
    }

}
