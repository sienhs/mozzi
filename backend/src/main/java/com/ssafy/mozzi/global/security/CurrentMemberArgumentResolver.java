package com.ssafy.mozzi.global.security;

import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import com.ssafy.mozzi.global.exception.BusinessException;

/**
 * Resolves {@link CurrentMember} to the id of the member {@link AuthenticationFilter}
 * authenticated.
 *
 * <p>The filter has already checked the access token and the session, so this only reads the
 * result. It is registered in {@code WebConfig} unconditionally: were it missing, Spring would
 * treat {@code Long memberId} as a plain request parameter and bind it from
 * {@code ?memberId=} — the opposite of failing closed.
 */
@Component
public class CurrentMemberArgumentResolver implements HandlerMethodArgumentResolver {

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
        Object member = webRequest.getAttribute(
                AuthenticationFilter.AUTHENTICATED_MEMBER, RequestAttributes.SCOPE_REQUEST);
        if (!(member instanceof AuthenticatedMember authenticated)) {
            // Only reachable if a public endpoint asks for the member, which is a coding error;
            // failing closed keeps it from running anonymously.
            throw new BusinessException(SecurityErrorCode.ACCESS_TOKEN_MISSING,
                    "@CurrentMember requested on a request the filter did not authenticate");
        }
        return authenticated.memberId();
    }

}
