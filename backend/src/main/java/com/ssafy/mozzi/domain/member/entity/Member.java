package com.ssafy.mozzi.domain.member.entity;

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
 * A member account (API spec ERD 5.1).
 *
 * <p>This is the reference implementation of the entity conventions: snake_case columns
 * derived from camelCase fields, {@code BaseTimeEntity} for the timestamps, string-stored
 * enums, and soft delete through {@code deleted_at}.
 *
 * <p>{@link SQLRestriction} filters withdrawn members out of <em>every</em> read Hibernate
 * generates, primary-key lookups included — verified on Hibernate 7 by
 * {@code MemberRepositoryTest}. The flip side is that a soft-deleted row becomes
 * unreachable through JPA entirely, so the one place that legitimately needs it (re-signup
 * inside the retention period) uses a native query. See {@code MemberRepository}.
 */
@Entity
@Table(name = "member")
@SQLRestriction("deleted_at is null")
public class Member extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "member_id")
    private Long id;

    @Column(nullable = false)
    private String email;

    /** Null until onboarding completes (spec 4.2). */
    @Column(length = 20)
    private String nickname;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AuthProvider provider;

    /** Google's {@code sub}; the stable identity, since an email address can change. */
    @Column(name = "provider_subject", nullable = false)
    private String providerSubject;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MemberRole role;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private MemberStatus status;

    @Column(name = "deleted_at")
    private OffsetDateTime deletedAt;

    protected Member() {
        // JPA
    }

    private Member(String email, AuthProvider provider, String providerSubject) {
        this.email = email;
        this.provider = provider;
        this.providerSubject = providerSubject;
        this.role = MemberRole.USER;
        this.status = MemberStatus.PENDING_PROFILE;
    }

    /**
     * A member created by a first Google sign-in, before a nickname exists.
     *
     * @see MemberStatus#PENDING_PROFILE
     */
    public static Member pendingProfile(String email, AuthProvider provider, String providerSubject) {
        return new Member(email, provider, providerSubject);
    }

    /** Onboarding: sets the nickname and opens the account up (spec 4.2). */
    public void completeOnboarding(String nickname) {
        this.nickname = nickname;
        this.status = MemberStatus.ACTIVE;
    }

    public void changeNickname(String nickname) {
        this.nickname = nickname;
    }

    /**
     * Withdrawal (spec 4.2). Rows stay until the retention batch removes them, so the
     * timestamp is what makes the retention period computable.
     */
    public void withdraw(Clock clock) {
        this.status = MemberStatus.WITHDRAWN;
        this.deletedAt = OffsetDateTime.now(clock);
    }

    public boolean isDeleted() {
        return deletedAt != null;
    }

    public Long getId() {
        return id;
    }

    public String getEmail() {
        return email;
    }

    public String getNickname() {
        return nickname;
    }

    public AuthProvider getProvider() {
        return provider;
    }

    public String getProviderSubject() {
        return providerSubject;
    }

    public MemberRole getRole() {
        return role;
    }

    public MemberStatus getStatus() {
        return status;
    }

    public OffsetDateTime getDeletedAt() {
        return deletedAt;
    }

}
