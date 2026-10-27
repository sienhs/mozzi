package com.ssafy.mozzi.domain.auth.service;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.mozzi.domain.auth.entity.MemberSession;
import com.ssafy.mozzi.domain.auth.exception.AuthErrorCode;
import com.ssafy.mozzi.domain.auth.repository.MemberSessionRepository;
import com.ssafy.mozzi.domain.member.entity.MemberStatus;
import com.ssafy.mozzi.global.exception.BusinessException;
import com.ssafy.mozzi.global.security.AccessSessionChecker;
import com.ssafy.mozzi.global.security.AccessTokenProvider;
import com.ssafy.mozzi.global.security.AccessTokenProvider.IssuedAccessToken;
import com.ssafy.mozzi.global.security.AuthProperties;
import com.ssafy.mozzi.global.security.SecureTokens;

/**
 * The member's single login session and its refresh token.
 *
 * <p>Methods that change a session require the caller's transaction, in which the member
 * row has already been locked ({@code MemberRepository#findActiveByIdForUpdate}). Taking that
 * lock first on every path is what keeps a login, a refresh, a logout and a withdrawal for
 * the same member from interleaving — and keeps the lock order the same everywhere.
 *
 * <p>Refresh token format: {@code <sessionId>.<secret>}. The session id only says which row
 * to look at; the hash of the whole string is what has to match.
 */
@Service
public class MemberSessionService implements AccessSessionChecker {

    private static final char REFRESH_SEPARATOR = '.';

    private final MemberSessionRepository sessionRepository;
    private final AccessTokenProvider accessTokenProvider;
    private final AuthProperties properties;
    private final Clock clock;

    public MemberSessionService(MemberSessionRepository sessionRepository, AccessTokenProvider accessTokenProvider,
            AuthProperties properties, Clock clock) {
        this.sessionRepository = sessionRepository;
        this.accessTokenProvider = accessTokenProvider;
        this.properties = properties;
        this.clock = clock;
    }

    /**
     * Starts a new session, ending whatever session the member had. The previous device's
     * access and refresh tokens stop working from its next request.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public IssuedTokens start(Long memberId) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        UUID sessionId = UUID.randomUUID();
        String refreshToken = refreshToken(sessionId);
        OffsetDateTime refreshExpiresAt = now.plus(properties.refreshTokenTtl());

        sessionRepository.deleteAllOfMember(memberId);
        sessionRepository.save(new MemberSession(
                memberId, sessionId, SecureTokens.sha256Hex(refreshToken), refreshExpiresAt));

        IssuedAccessToken access = accessTokenProvider.issue(memberId, sessionId);
        return new IssuedTokens(access.token(), access.expiresAt(), refreshToken, refreshExpiresAt);
    }

    /**
     * Reads the session a refresh token points at and checks the token against it, without
     * locking. The caller locks the member and then calls {@link #rotate}, which re-checks
     * everything in its update.
     *
     * @return the session's member id
     * @throws BusinessException {@code REFRESH_TOKEN_INVALID} or {@code REFRESH_TOKEN_EXPIRED}
     */
    public Long ownerOf(String refreshToken) {
        UUID sessionId = sessionIdOf(refreshToken);
        MemberSession session = sessionRepository.findBySessionId(sessionId)
                .orElseThrow(() -> new BusinessException(AuthErrorCode.REFRESH_TOKEN_INVALID, "no such session"));
        if (!SecureTokens.hashesMatch(session.getRefreshTokenHash(), SecureTokens.sha256Hex(refreshToken))) {
            throw new BusinessException(AuthErrorCode.REFRESH_TOKEN_INVALID, "refresh token is not the current one");
        }
        if (!OffsetDateTime.now(clock).isBefore(session.getRefreshExpiresAt())) {
            throw new BusinessException(AuthErrorCode.REFRESH_TOKEN_EXPIRED, "refresh token expired");
        }
        return session.getMemberId();
    }

    /**
     * Replaces the refresh token and extends the session to now + 30 days, keeping the
     * session id. Only one of several concurrent calls with the same token succeeds; the
     * others fail without touching the session.
     *
     * @throws BusinessException {@code REFRESH_TOKEN_INVALID} if the token stopped being
     *                           current since {@link #ownerOf}
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public IssuedTokens rotate(Long memberId, String refreshToken) {
        UUID sessionId = sessionIdOf(refreshToken);
        OffsetDateTime now = OffsetDateTime.now(clock);
        String newRefreshToken = refreshToken(sessionId);
        OffsetDateTime refreshExpiresAt = now.plus(properties.refreshTokenTtl());

        int rotated = sessionRepository.rotate(memberId, sessionId, SecureTokens.sha256Hex(refreshToken),
                SecureTokens.sha256Hex(newRefreshToken), refreshExpiresAt, now);
        if (rotated != 1) {
            throw new BusinessException(AuthErrorCode.REFRESH_TOKEN_INVALID, "refresh token no longer current");
        }

        IssuedAccessToken access = accessTokenProvider.issue(memberId, sessionId);
        return new IssuedTokens(access.token(), access.expiresAt(), newRefreshToken, refreshExpiresAt);
    }

    /** Logout: ends the session only if it is still the one the request was made with. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void end(Long memberId, UUID sessionId) {
        sessionRepository.deleteSession(memberId, sessionId);
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void endAll(Long memberId) {
        sessionRepository.deleteAllOfMember(memberId);
    }

    @Override
    @Transactional(readOnly = true)
    public boolean isCurrent(Long memberId, UUID sessionId) {
        return sessionRepository.existsCurrent(memberId, sessionId, OffsetDateTime.now(clock), MemberStatus.ACTIVE);
    }

    private static String refreshToken(UUID sessionId) {
        return sessionId.toString() + REFRESH_SEPARATOR + SecureTokens.randomToken();
    }

    /**
     * The session id part of a refresh token. Anything that is not exactly
     * {@code <canonical uuid>.<non-empty secret>} is invalid; {@link UUID#fromString} alone
     * would also accept non-canonical spellings.
     */
    private static UUID sessionIdOf(String refreshToken) {
        int separator = refreshToken.indexOf(REFRESH_SEPARATOR);
        if (separator < 0 || separator == refreshToken.length() - 1) {
            throw new BusinessException(AuthErrorCode.REFRESH_TOKEN_INVALID, "malformed refresh token");
        }
        String sessionPart = refreshToken.substring(0, separator);
        try {
            UUID sessionId = UUID.fromString(sessionPart);
            if (!sessionId.toString().equals(sessionPart)) {
                throw new IllegalArgumentException("non-canonical uuid");
            }
            return sessionId;
        } catch (IllegalArgumentException e) {
            throw new BusinessException(AuthErrorCode.REFRESH_TOKEN_INVALID, "malformed refresh token");
        }
    }

}
