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
 * {@code MemberRepositoryTest}. A withdrawn row stays in the table, but nothing needs to
 * reach it: signing up again with the same Google account creates a new member, so earlier
 * data is never reattached.
 *
 * <p>A row is created only once sign-up completes, so every member has a nickname. The
 * nickname cannot be changed afterwards and there is deliberately no method to do so.
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

    /** Fixed at sign-up. See {@link Nickname} for the rules. */
    @Column(nullable = false, length = Nickname.MAX_LENGTH)
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

    private Member(String email, AuthProvider provider, String providerSubject, String nickname) {
        this.email = email;
        this.provider = provider;
        this.providerSubject = providerSubject;
        this.nickname = nickname;
        this.role = MemberRole.USER;
        this.status = MemberStatus.ACTIVE;
    }

    /**
     * A member whose sign-up has just completed: Google verified the identity and the
     * nickname was submitted.
     *
     * @param email           Google's verified email; stored, never used to find or merge accounts
     * @param providerSubject Google's {@code sub}, the account's identity
     */
    public static Member signUp(String email, AuthProvider provider, String providerSubject, String nickname) {
        return new Member(email, provider, providerSubject, nickname);
    }

    /**
     * Withdrawal (spec 4.2). The row stays until the retention batch removes it, so the
     * timestamp is what makes the retention period computable. It does not block signing up
     * again: the unique indexes only cover rows that are not deleted.
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
