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
 * Hands the {@link AuthenticatedMember} set by {@link AuthenticationFilter} to a controller
 * parameter of that type.
 *
 * <p>Request-scoped by construction: the value lives in a request attribute, so there is no
 * thread-local to clean up.
 */
@Component
public class AuthenticatedMemberArgumentResolver implements HandlerMethodArgumentResolver {

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return AuthenticatedMember.class.equals(parameter.getParameterType());
    }

    @Override
    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
            NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
        Object member = webRequest.getAttribute(
                AuthenticationFilter.AUTHENTICATED_MEMBER, RequestAttributes.SCOPE_REQUEST);
        if (member == null) {
            // Only reachable if a public endpoint asks for the member, which is a coding error;
            // failing closed keeps it from running anonymously.
            throw new BusinessException(SecurityErrorCode.ACCESS_TOKEN_MISSING,
                    "AuthenticatedMember requested on a request the filter did not authenticate");
        }
        return member;
    }

}
