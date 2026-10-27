package com.ssafy.mozzi.global.security;

import java.util.UUID;

/**
 * Answers whether an access token's session is still the member's current one.
 *
 * <p>An interface so that {@code global} does not depend on the auth domain, which owns the
 * session table and implements this.
 */
public interface AccessSessionChecker {

    /**
     * @return true only if the member is active and {@code sessionId} is their current,
     *         unexpired session
     */
    boolean isCurrent(Long memberId, UUID sessionId);

}
