package com.ssafy.mozzi.global.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.UUID;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.ServletWebRequest;

import com.ssafy.mozzi.global.exception.BusinessException;

/**
 * The resolver only reads what the filter established, and fails closed without it.
 */
class CurrentMemberArgumentResolverTest {

    private final CurrentMemberArgumentResolver resolver = new CurrentMemberArgumentResolver();

    @Test
    void returnsTheAuthenticatedMembersId() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setAttribute(AuthenticationFilter.AUTHENTICATED_MEMBER, new AuthenticatedMember(7L, UUID.randomUUID()));

        assertThat(resolver.resolveArgument(null, null, new ServletWebRequest(request), null)).isEqualTo(7L);
    }

    /** A header naming a member is not authentication; only the filter's result counts. */
    @Test
    void withoutAuthenticationItRefuses() {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("X-Member-Id", "7");

        assertThatThrownBy(() -> resolver.resolveArgument(null, null, new ServletWebRequest(request), null))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(SecurityErrorCode.ACCESS_TOKEN_MISSING);
    }

}
