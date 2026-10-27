package com.ssafy.mozzi.global.security;

import java.io.IOException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.dao.DataAccessException;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.transaction.TransactionException;
import org.springframework.web.filter.OncePerRequestFilter;

import com.ssafy.mozzi.global.exception.BusinessException;
import com.ssafy.mozzi.global.exception.ErrorCode;
import com.ssafy.mozzi.global.exception.ErrorResponseWriter;
import com.ssafy.mozzi.global.logging.RequestTrace;

/**
 * Requires a valid access token of the member's current session on every request outside
 * {@link PublicEndpoints}.
 *
 * <p>Two checks: the token itself (signature, issuer, audience, expiry), then one small
 * database query that the session is still current and the member still active. The second
 * is what makes single login work — after a login elsewhere the old token is still
 * correctly signed, but its session is gone. The query takes no lock, so a request that has
 * already passed it finishes even if the session is replaced meanwhile.
 *
 * <p>Runs after {@code TraceIdFilter} and {@code RequestLoggingFilter}, so a rejection
 * carries a trace id and still gets its access-log line. Rejections are written through
 * {@link ErrorResponseWriter}, since the controller advice cannot see this filter.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class AuthenticationFilter extends OncePerRequestFilter {

    /** Request attribute holding the {@link AuthenticatedMember}. */
    static final String AUTHENTICATED_MEMBER = AuthenticatedMember.class.getName();

    private static final Logger log = LoggerFactory.getLogger(AuthenticationFilter.class);

    private static final String BEARER_PREFIX = "Bearer ";

    private final AccessTokenProvider accessTokenProvider;
    private final AccessSessionChecker sessionChecker;
    private final ErrorResponseWriter errorResponseWriter;

    public AuthenticationFilter(
            AccessTokenProvider accessTokenProvider,
            AccessSessionChecker sessionChecker,
            ErrorResponseWriter errorResponseWriter) {
        this.accessTokenProvider = accessTokenProvider;
        this.sessionChecker = sessionChecker;
        this.errorResponseWriter = errorResponseWriter;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return PublicEndpoints.matches(request);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String token = bearerToken(request);
        if (token == null) {
            reject(response, SecurityErrorCode.ACCESS_TOKEN_MISSING);
            return;
        }

        AuthenticatedMember member;
        try {
            member = accessTokenProvider.verify(token);
            if (!sessionChecker.isCurrent(member.memberId(), member.sessionId())) {
                reject(response, SecurityErrorCode.SESSION_REVOKED);
                return;
            }
        } catch (BusinessException e) {
            reject(response, e.errorCode());
            return;
        } catch (DataAccessException | TransactionException e) {
            // Not the client's fault and not a reason to drop its tokens: answering 401 here
            // would log every user out during a database blip.
            log.error("session lookup failed", e);
            reject(response, SecurityErrorCode.AUTH_SERVICE_UNAVAILABLE);
            return;
        }

        request.setAttribute(AUTHENTICATED_MEMBER, member);
        RequestTrace.putMemberId(member.memberId());
        chain.doFilter(request, response);
    }

    private static String bearerToken(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.regionMatches(true, 0, BEARER_PREFIX, 0, BEARER_PREFIX.length())) {
            return null;
        }
        String token = header.substring(BEARER_PREFIX.length()).trim();
        return token.isEmpty() ? null : token;
    }

    private void reject(HttpServletResponse response, ErrorCode errorCode) throws IOException {
        errorResponseWriter.write(response, errorCode);
    }

}
