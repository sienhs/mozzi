package com.ssafy.mozzi.domain.auth.entity;

import java.time.OffsetDateTime;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.global.entity.BaseTimeEntity;

/**
 * A Google identity that has been verified but has no member yet, waiting for its nickname.
 *
 * <p>Single use: sign-up deletes it in the same transaction that creates the member, so a
 * failed sign-up leaves it in place to retry with a different nickname. A random token is
 * used instead of a JWT because a JWT cannot be "used up" without storing it anyway.
 */
@Entity
@Table(name = "signup_ticket")
public class SignupTicket extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "signup_ticket_id")
    private Long id;

    /** SHA-256 of the token handed to the app; the token itself is never stored. */
    @Column(name = "token_hash", nullable = false, length = 64)
    private String tokenHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AuthProvider provider;

    @Column(name = "provider_subject", nullable = false)
    private String providerSubject;

    @Column(nullable = false)
    private String email;

    @Column(name = "expires_at", nullable = false)
    private OffsetDateTime expiresAt;

    protected SignupTicket() {
        // JPA
    }

    public SignupTicket(String tokenHash, AuthProvider provider, String providerSubject, String email,
            OffsetDateTime expiresAt) {
        this.tokenHash = tokenHash;
        this.provider = provider;
        this.providerSubject = providerSubject;
        this.email = email;
        this.expiresAt = expiresAt;
    }

    public boolean isExpiredAt(OffsetDateTime now) {
        return !now.isBefore(expiresAt);
    }

    public Long getId() {
        return id;
    }

    public String getTokenHash() {
        return tokenHash;
    }

    public AuthProvider getProvider() {
        return provider;
    }

    public String getProviderSubject() {
        return providerSubject;
    }

    public String getEmail() {
        return email;
    }

    public OffsetDateTime getExpiresAt() {
        return expiresAt;
    }

}
