package com.ssafy.mozzi.global.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.global.exception.BusinessException;
import com.ssafy.mozzi.global.exception.CommonErrorCode;
import com.ssafy.mozzi.global.logging.RequestTrace;

/**
 * Resolves {@link CurrentMember}.
 *
 * <p><strong>Temporary.</strong> Spring Security (build step 4) is being written separately.
 * Until it lands, the member id comes from the {@value #MOCK_HEADER} header, and only when
 * {@code mozzi.auth.mock-header-enabled} is true — set in the local and test profiles,
 * absent in prod. With the flag off every request is answered 401, so a prod build cannot
 * be used to act as an arbitrary member by sending a header.
 *
 * <p>When Security lands, replace the body of {@link #resolveArgument} with a read of the
 * authenticated principal, delete the flag and the header, and leave the controllers alone.
 *
 * <p>The resolver is registered in {@code WebConfig} unconditionally. Were it registered
 * only when the flag is on, Spring would treat {@code Long memberId} as a plain request
 * parameter and bind it from {@code ?memberId=} — the opposite of failing closed.
 */
@Component
public class CurrentMemberArgumentResolver implements HandlerMethodArgumentResolver {

    public static final String MOCK_HEADER = "X-Member-Id";

    private final boolean mockHeaderEnabled;
    private final MemberRepository memberRepository;

    public CurrentMemberArgumentResolver(
            @Value("${mozzi.auth.mock-header-enabled:false}") boolean mockHeaderEnabled,
            MemberRepository memberRepository) {
        this.mockHeaderEnabled = mockHeaderEnabled;
        this.memberRepository = memberRepository;
    }

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return parameter.hasParameterAnnotation(CurrentMember.class)
                && Long.class.equals(parameter.getParameterType());
    }

    @Override
    public Long resolveArgument(
            MethodParameter parameter,
            ModelAndViewContainer mavContainer,
            NativeWebRequest webRequest,
            WebDataBinderFactory binderFactory) {
        if (!mockHeaderEnabled) {
            throw new BusinessException(CommonErrorCode.UNAUTHORIZED, "no authentication wired; mock header disabled");
        }
        Long memberId = parse(webRequest.getHeader(MOCK_HEADER));
        // Checked so a typo in the header is a 401 rather than a foreign-key violation (500)
        // on the first insert. Real authentication guarantees this by issuing the token.
        if (memberRepository.findByIdAndDeletedAtIsNull(memberId).isEmpty()) {
            throw new BusinessException(CommonErrorCode.UNAUTHORIZED, "mock member not found: " + memberId);
        }
        RequestTrace.putMemberId(memberId);
        return memberId;
    }

    private static Long parse(String header) {
        if (header == null || header.isBlank()) {
            throw new BusinessException(CommonErrorCode.UNAUTHORIZED, MOCK_HEADER + " header missing");
        }
        try {
            return Long.valueOf(header.strip());
        } catch (NumberFormatException e) {
            throw new BusinessException(CommonErrorCode.UNAUTHORIZED, MOCK_HEADER + " header is not a number");
        }
    }

}
