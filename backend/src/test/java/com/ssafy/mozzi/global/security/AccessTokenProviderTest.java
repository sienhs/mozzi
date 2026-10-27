package com.ssafy.mozzi.global.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Date;
import java.util.UUID;

import org.junit.jupiter.api.Test;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.PlainHeader;
import com.nimbusds.jose.crypto.MACSigner;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.PlainJWT;
import com.nimbusds.jwt.SignedJWT;
import com.ssafy.mozzi.global.exception.BusinessException;

class AccessTokenProviderTest {

    private static final String SECRET = "test-only-jwt-secret-of-at-least-32-bytes";
    private static final Instant NOW = Instant.parse("2026-10-27T03:00:00Z");
    private static final ZoneId SEOUL = ZoneId.of("Asia/Seoul");

    private final AccessTokenProvider provider = providerAt(NOW);

    @Test
    void issuedTokenVerifiesToTheSameMemberAndSession() {
        UUID sessionId = UUID.randomUUID();

        AccessTokenProvider.IssuedAccessToken issued = provider.issue(7L, sessionId);

        assertThat(provider.verify(issued.token())).isEqualTo(new AuthenticatedMember(7L, sessionId));
        assertThat(issued.expiresAt().toInstant()).isEqualTo(NOW.plus(Duration.ofMinutes(30)));
    }

    @Test
    void carriesNoPersonalDataAndTheAgreedClaims() throws Exception {
        String token = provider.issue(7L, UUID.randomUUID()).token();

        JWTClaimsSet claims = SignedJWT.parse(token).getJWTClaimsSet();
        assertThat(claims.getClaims().keySet())
                .containsExactlyInAnyOrder("sub", "sid", "iss", "aud", "iat", "exp", "jti", "token_use");
    }

    @Test
    void expiredTokenIsReportedAsExpired() {
        String token = provider.issue(7L, UUID.randomUUID()).token();

        assertThatThrownBy(() -> providerAt(NOW.plus(Duration.ofMinutes(30))).verify(token))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(SecurityErrorCode.ACCESS_TOKEN_EXPIRED);
    }

    @Test
    void tokenSignedWithAnotherKeyIsInvalid() throws Exception {
        String forged = sign(validClaims(), "another-secret-that-is-also-32-bytes-long");

        assertInvalid(forged);
    }

    /** Signature is checked before expiry, so a forged expired token is not "expired". */
    @Test
    void forgedExpiredTokenIsInvalidNotExpired() throws Exception {
        JWTClaimsSet expired = new JWTClaimsSet.Builder(validClaims())
                .expirationTime(Date.from(NOW.minusSeconds(1))).build();

        assertInvalid(sign(expired, "another-secret-that-is-also-32-bytes-long"));
    }

    @Test
    void unsignedTokenIsInvalid() {
        String unsigned = new PlainJWT(new PlainHeader(), validClaims()).serialize();

        assertInvalid(unsigned);
    }

    @Test
    void otherAlgorithmWithTheSameKeyIsInvalid() throws Exception {
        SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS512), validClaims());
        jwt.sign(new MACSigner((SECRET + SECRET).getBytes()));

        assertInvalid(jwt.serialize());
    }

    @Test
    void wrongAudienceIssuerOrUseIsInvalid() throws Exception {
        assertInvalid(sign(new JWTClaimsSet.Builder(validClaims()).audience("someone-else").build(), SECRET));
        assertInvalid(sign(new JWTClaimsSet.Builder(validClaims()).issuer("someone-else").build(), SECRET));
        assertInvalid(sign(new JWTClaimsSet.Builder(validClaims()).claim("token_use", "refresh").build(), SECRET));
        assertInvalid(sign(new JWTClaimsSet.Builder(validClaims()).subject("not-a-number").build(), SECRET));
        assertInvalid(sign(new JWTClaimsSet.Builder(validClaims()).claim("sid", null).build(), SECRET));
    }

    @Test
    void garbageIsInvalid() {
        assertInvalid("not-a-jwt");
    }

    @Test
    void shortSecretStopsStartup() {
        AuthProperties weak = properties("too-short");

        assertThatThrownBy(() -> new AccessTokenProvider(weak, Clock.fixed(NOW, SEOUL)))
                .isInstanceOf(IllegalStateException.class);
    }

    private void assertInvalid(String token) {
        assertThatThrownBy(() -> provider.verify(token))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(SecurityErrorCode.ACCESS_TOKEN_INVALID);
    }

    private static JWTClaimsSet validClaims() {
        return new JWTClaimsSet.Builder()
                .subject("7")
                .issuer("mozzi")
                .audience("mozzi-app")
                .issueTime(Date.from(NOW))
                .expirationTime(Date.from(NOW.plusSeconds(600)))
                .jwtID(UUID.randomUUID().toString())
                .claim("sid", UUID.randomUUID().toString())
                .claim("token_use", "access")
                .build();
    }

    private static String sign(JWTClaimsSet claims, String secret) throws Exception {
        SignedJWT jwt = new SignedJWT(new JWSHeader(JWSAlgorithm.HS256), claims);
        jwt.sign(new MACSigner(secret.getBytes()));
        return jwt.serialize();
    }

    private static AccessTokenProvider providerAt(Instant now) {
        return new AccessTokenProvider(properties(SECRET), Clock.fixed(now, SEOUL));
    }

    private static AuthProperties properties(String secret) {
        return new AuthProperties("mozzi", "mozzi-app", secret,
                Duration.ofMinutes(30), Duration.ofDays(30), Duration.ofMinutes(10));
    }

}
