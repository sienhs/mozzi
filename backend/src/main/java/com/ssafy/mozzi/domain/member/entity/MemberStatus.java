package com.ssafy.mozzi.domain.member.entity;

/**
 * Lifecycle of a member account (API spec ERD 5.1).
 *
 * <p>There is no "signed in but no nickname yet" state: until the nickname is submitted the
 * Google identity lives in a sign-up ticket, not in a member row. Migration V4 refuses to run
 * while rows in the former {@code PENDING_PROFILE} state exist, so none can be read back.
 */
public enum MemberStatus {
    ACTIVE,
    WITHDRAWN
}
