package com.ssafy.mozzi.domain.auth.entity;

import java.time.OffsetDateTime;
import java.util.UUID;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PostLoad;
import jakarta.persistence.PostPersist;
import jakarta.persistence.Table;
import jakarta.persistence.Transient;

import org.springframework.data.domain.Persistable;

import com.ssafy.mozzi.global.entity.BaseTimeEntity;

/**
 * A member's one current login session, holding the hash of its refresh token.
 *
 * <p>The primary key is the member id, which is what limits a member to a single session.
 * The member is referenced by id only, not by a JPA association, so checking a session on
 * every request never loads the member.
 *
 * <p>A new Google login replaces the row (delete, then insert) rather than updating it, so
 * {@code created_at} is the time of that login. A refresh updates the hash and expiry in
 * place through a conditional update — see {@code MemberSessionRepository#rotate}.
 *
 * <p>{@link Persistable} because the id is assigned, not generated: without it Spring Data
 * would treat every new session as an existing row and issue a select before the insert.
 */
@Entity
@Table(name = "member_session")
public class MemberSession extends BaseTimeEntity implements Persistable<Long> {

    @Id
    @Column(name = "member_id")
    private Long memberId;

    @Column(name = "session_id", nullable = false, updatable = false)
    private UUID sessionId;

    @Column(name = "refresh_token_hash", nullable = false, length = 64)
    private String refreshTokenHash;

    @Column(name = "refresh_expires_at", nullable = false)
    private OffsetDateTime refreshExpiresAt;

    @Transient
    private boolean newEntity = true;

    protected MemberSession() {
        // JPA
    }

    public MemberSession(Long memberId, UUID sessionId, String refreshTokenHash, OffsetDateTime refreshExpiresAt) {
        this.memberId = memberId;
        this.sessionId = sessionId;
        this.refreshTokenHash = refreshTokenHash;
        this.refreshExpiresAt = refreshExpiresAt;
    }

    @PostLoad
    @PostPersist
    void markPersisted() {
        this.newEntity = false;
    }

    @Override
    public Long getId() {
        return memberId;
    }

    @Override
    public boolean isNew() {
        return newEntity;
    }

    public Long getMemberId() {
        return memberId;
    }

    public UUID getSessionId() {
        return sessionId;
    }

    public String getRefreshTokenHash() {
        return refreshTokenHash;
    }

    public OffsetDateTime getRefreshExpiresAt() {
        return refreshExpiresAt;
    }

}
