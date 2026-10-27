package com.ssafy.mozzi.global.security;

import java.util.UUID;

/**
 * Who made the current request, as established by {@link AuthenticationFilter}.
 *
 * <p>Declare it as a controller parameter to receive it. It only says who is calling;
 * whether that member may touch a given resource is still each service's own check.
 *
 * @param memberId  internal member id
 * @param sessionId the login session the access token belongs to
 */
public record AuthenticatedMember(Long memberId, UUID sessionId) {
}
