package com.ssafy.mozzi.domain.member.entity;

/**
 * Lifecycle of a member account (API spec ERD 5.1).
 *
 * <p>{@link #PENDING_PROFILE} is what the {@code 403 ONBOARDING_REQUIRED} guard checks:
 * the account exists because Google authenticated it, but no nickname has been chosen yet.
 */
public enum MemberStatus {
    PENDING_PROFILE,
    ACTIVE,
    WITHDRAWN
}
