package com.ssafy.mozzi.domain.member.entity;

import java.time.OffsetDateTime;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * One document version a member agreed to (API spec ERD 5.3).
 *
 * <p>Rows are only ever written from what the member submitted at sign-up. The server never
 * records an agreement on the member's behalf.
 *
 * <p>Not a {@code BaseTimeEntity}: the table has {@code agreed_at} instead of the audit
 * columns, and a row is never updated.
 */
@Entity
@Table(name = "terms_agreement")
public class TermsAgreement {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "terms_agreement_id")
    private Long id;

    @Column(name = "member_id", nullable = false)
    private Long memberId;

    @Enumerated(EnumType.STRING)
    @Column(name = "terms_type", nullable = false, length = 20)
    private TermsType termsType;

    @Column(name = "terms_version", nullable = false, length = 20)
    private String termsVersion;

    @Column(name = "agreed_at", nullable = false)
    private OffsetDateTime agreedAt;

    protected TermsAgreement() {
        // JPA
    }

    public TermsAgreement(Long memberId, TermsType termsType, String termsVersion, OffsetDateTime agreedAt) {
        this.memberId = memberId;
        this.termsType = termsType;
        this.termsVersion = termsVersion;
        this.agreedAt = agreedAt;
    }

    public Long getId() {
        return id;
    }

    public Long getMemberId() {
        return memberId;
    }

    public TermsType getTermsType() {
        return termsType;
    }

    public String getTermsVersion() {
        return termsVersion;
    }

    public OffsetDateTime getAgreedAt() {
        return agreedAt;
    }

}
