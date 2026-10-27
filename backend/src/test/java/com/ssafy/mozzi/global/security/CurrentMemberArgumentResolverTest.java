package com.ssafy.mozzi.global.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.context.request.ServletWebRequest;

import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.global.exception.BusinessException;
import com.ssafy.mozzi.global.exception.CommonErrorCode;

/**
 * The temporary resolver must fail closed: without the flag no header is trusted.
 */
class CurrentMemberArgumentResolverTest {

    private final MemberRepository memberRepository = mock(MemberRepository.class);

    @Test
    void headerIsIgnoredWhenTheFlagIsOff() {
        when(memberRepository.findByIdAndDeletedAtIsNull(any())).thenReturn(Optional.of(mock(Member.class)));
        CurrentMemberArgumentResolver resolver = new CurrentMemberArgumentResolver(false, memberRepository);

        assertUnauthorized(() -> resolver.resolveArgument(null, null, requestWithHeader("1"), null));
    }

    @Test
    void headerNamesTheMemberWhenTheFlagIsOn() {
        when(memberRepository.findByIdAndDeletedAtIsNull(7L)).thenReturn(Optional.of(mock(Member.class)));
        CurrentMemberArgumentResolver resolver = new CurrentMemberArgumentResolver(true, memberRepository);

        assertThat(resolver.resolveArgument(null, null, requestWithHeader("7"), null)).isEqualTo(7L);
    }

    @Test
    void missingOrMalformedHeaderIsUnauthorized() {
        CurrentMemberArgumentResolver resolver = new CurrentMemberArgumentResolver(true, memberRepository);

        assertUnauthorized(() -> resolver.resolveArgument(null, null, requestWithHeader(null), null));
        assertUnauthorized(() -> resolver.resolveArgument(null, null, requestWithHeader("abc"), null));
    }

    @Test
    void unknownMemberIsUnauthorized() {
        when(memberRepository.findByIdAndDeletedAtIsNull(any())).thenReturn(Optional.empty());
        CurrentMemberArgumentResolver resolver = new CurrentMemberArgumentResolver(true, memberRepository);

        assertUnauthorized(() -> resolver.resolveArgument(null, null, requestWithHeader("99"), null));
    }

    private static ServletWebRequest requestWithHeader(String memberId) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        if (memberId != null) {
            request.addHeader(CurrentMemberArgumentResolver.MOCK_HEADER, memberId);
        }
        return new ServletWebRequest(request);
    }

    private static void assertUnauthorized(org.assertj.core.api.ThrowableAssert.ThrowingCallable call) {
        assertThatThrownBy(call)
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(CommonErrorCode.UNAUTHORIZED);
    }

}
