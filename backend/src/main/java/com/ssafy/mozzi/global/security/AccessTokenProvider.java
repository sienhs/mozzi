package com.ssafy.mozzi.global.security;

import java.nio.charset.StandardCharsets;
import java.text.ParseException;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.Date;
import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Component;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JOSEObjectType;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.JWSSigner;
import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jose.crypto.MACVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import com.ssafy.mozzi.global.exception.BusinessException;

/**
 * Signs and verifies the access tokens this server issues.
 *
 * <p>Claims: {@code sub} (member id), {@code sid} (session id), {@code iss}, {@code aud},
 * {@code iat}, {@code exp}, {@code jti} and {@code token_use=access}. No email or nickname:
 * the token is readable by anyone holding it.
 *
 * <p>The algorithm is fixed to HS256 by this class and checked before the signature, so a
 * token cannot pick its own algorithm ({@code alg: none} and friends).
 *
 * <p>A valid token is not enough to authenticate a request: {@link AuthenticationFilter}
 * also checks that its session is still current.
 */
@Component
public class AccessTokenProvider {

    static final String SESSION_ID_CLAIM = "sid";
    static final String TOKEN_USE_CLAIM = "token_use";
    static final String TOKEN_USE_ACCESS = "access";

    private static final JWSAlgorithm ALGORITHM = JWSAlgorithm.HS256;
    private static final int MIN_SECRET_BYTES = 32;

    private final JWSSigner signer;
    private final JWSVerifier verifier;
    private final AuthProperties properties;
    private final Clock clock;

    public AccessTokenProvider(AuthProperties properties, Clock clock) {
        byte[] secret = properties.jwtSecret().getBytes(StandardCharsets.UTF_8);
        if (secret.length < MIN_SECRET_BYTES) {
            // Fail at startup rather than on the first login. HS256 needs a 256-bit key.
            throw new IllegalStateException(
                    "mozzi.auth.jwt-secret must be at least " + MIN_SECRET_BYTES + " bytes");
        }
        try {
            this.signer = new MACSigner(secret);
            this.verifier = new MACVerifier(secret);
        } catch (JOSEException e) {
            throw new IllegalStateException("invalid mozzi.auth.jwt-secret", e);
        }
        this.properties = properties;
        this.clock = clock;
    }

    /** Signs a token for the member's session, valid for {@code mozzi.auth.access-token-ttl}. */
    public IssuedAccessToken issue(Long memberId, UUID sessionId) {
        OffsetDateTime issuedAt = OffsetDateTime.now(clock);
        OffsetDateTime expiresAt = issuedAt.plus(properties.accessTokenTtl());
        JWTClaimsSet claims = new JWTClaimsSet.Builder()
                .subject(String.valueOf(memberId))
                .issuer(properties.issuer())
                .audience(properties.audience())
                .issueTime(Date.from(issuedAt.toInstant()))
                .expirationTime(Date.from(expiresAt.toInstant()))
                .jwtID(UUID.randomUUID().toString())
                .claim(SESSION_ID_CLAIM, sessionId.toString())
                .claim(TOKEN_USE_CLAIM, TOKEN_USE_ACCESS)
                .build();
        SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(ALGORITHM).type(JOSEObjectType.JWT).build(), claims);
        try {
            jwt.sign(signer);
        } catch (JOSEException e) {
            throw new IllegalStateException("failed to sign an access token", e);
        }
        return new IssuedAccessToken(jwt.serialize(), expiresAt);
    }

    /**
     * Checks algorithm, signature, issuer, audience, token use and expiry, in that order.
     *
     * <p>Expiry is checked last so that {@code ACCESS_TOKEN_EXPIRED} — the one code that
     * makes the app refresh — is only ever returned for a token this server really signed.
     *
     * @throws BusinessException {@code ACCESS_TOKEN_EXPIRED} or {@code ACCESS_TOKEN_INVALID}
     */
    public AuthenticatedMember verify(String token) {
        try {
            SignedJWT jwt = SignedJWT.parse(token);
            if (!ALGORITHM.equals(jwt.getHeader().getAlgorithm()) || !jwt.verify(verifier)) {
                throw invalid("bad algorithm or signature");
            }
            JWTClaimsSet claims = jwt.getJWTClaimsSet();
            if (!properties.issuer().equals(claims.getIssuer())) {
                throw invalid("unexpected issuer");
            }
            List<String> audience = claims.getAudience();
            if (audience == null || !audience.contains(properties.audience())) {
                throw invalid("unexpected audience");
            }
            if (!TOKEN_USE_ACCESS.equals(claims.getStringClaim(TOKEN_USE_CLAIM))) {
                throw invalid("not an access token");
            }
            String subject = claims.getSubject();
            String sessionId = claims.getStringClaim(SESSION_ID_CLAIM);
            Date expiresAt = claims.getExpirationTime();
            if (subject == null || sessionId == null || expiresAt == null) {
                throw invalid("missing claim");
            }
            AuthenticatedMember member = new AuthenticatedMember(Long.valueOf(subject), UUID.fromString(sessionId));
            if (!clock.instant().isBefore(expiresAt.toInstant())) {
                throw new BusinessException(SecurityErrorCode.ACCESS_TOKEN_EXPIRED, "access token expired");
            }
            return member;
        } catch (ParseException | JOSEException | IllegalArgumentException e) {
            // IllegalArgumentException covers NumberFormatException from a non-numeric sub and
            // a malformed sid.
            throw invalid(e.getClass().getSimpleName());
        }
    }

    private static BusinessException invalid(String logDetail) {
        return new BusinessException(SecurityErrorCode.ACCESS_TOKEN_INVALID, "access token rejected: " + logDetail);
    }

    /**
     * @param token     the compact JWT
     * @param expiresAt when it stops being accepted, returned to the app as {@code accessExpiresAt}
     */
    public record IssuedAccessToken(String token, OffsetDateTime expiresAt) {
    }

}
