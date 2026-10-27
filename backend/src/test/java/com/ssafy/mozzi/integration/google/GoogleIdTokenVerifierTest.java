package com.ssafy.mozzi.integration.google;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Date;
import java.util.List;

import org.junit.jupiter.api.Test;

import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.JWSHeader;
import com.nimbusds.jose.KeySourceException;
import com.nimbusds.jose.PlainHeader;
import com.nimbusds.jose.crypto.RSASSASigner;
import com.nimbusds.jose.jwk.JWKSet;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jose.jwk.gen.RSAKeyGenerator;
import com.nimbusds.jose.jwk.source.ImmutableJWKSet;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.PlainJWT;
import com.nimbusds.jwt.SignedJWT;

/**
 * Runs the real verification against a locally generated key set standing in for Google's.
 */
class GoogleIdTokenVerifierTest {

    private static final String CLIENT_ID = "web-client-id.apps.googleusercontent.com";
    private static final Instant NOW = Instant.parse("2026-10-27T03:00:00Z");

    private static final RSAKey GOOGLE_KEY = generateKey("google-key");
    private static final RSAKey OTHER_KEY = generateKey("google-key");

    private final GoogleIdTokenVerifier verifier = verifierUsing(
            new ImmutableJWKSet<>(new JWKSet(GOOGLE_KEY.toPublicJWK())));

    @Test
    void validTokenYieldsSubjectAndVerifiedEmail() throws Exception {
        GoogleIdentity identity = verifier.verify(sign(claims().build(), GOOGLE_KEY));

        assertThat(identity).isEqualTo(new GoogleIdentity("google-sub-1", "haru@gmail.com"));
    }

    @Test
    void bothIssuerSpellingsAreAccepted() throws Exception {
        JWTClaimsSet bare = claims().issuer("accounts.google.com").build();

        assertThat(verifier.verify(sign(bare, GOOGLE_KEY)).subject()).isEqualTo("google-sub-1");
    }

    /** The identity is still fine; sign-up is what refuses an unverified email. */
    @Test
    void unverifiedEmailIsDropped() throws Exception {
        JWTClaimsSet unverified = claims().claim("email_verified", false).build();

        assertThat(verifier.verify(sign(unverified, GOOGLE_KEY)).email()).isNull();
    }

    @Test
    void tokenForAnotherAppIsRejected() throws Exception {
        assertRejected(sign(claims().audience("someone-elses-client").build(), GOOGLE_KEY));
    }

    @Test
    void tokenFromAnotherIssuerIsRejected() throws Exception {
        assertRejected(sign(claims().issuer("https://evil.example").build(), GOOGLE_KEY));
    }

    @Test
    void expiredTokenIsRejected() throws Exception {
        JWTClaimsSet expired = claims().expirationTime(Date.from(NOW.minusSeconds(120))).build();

        assertRejected(sign(expired, GOOGLE_KEY));
    }

    @Test
    void tokenSignedByAnotherKeyIsRejected() throws Exception {
        assertRejected(sign(claims().build(), OTHER_KEY));
    }

    /** Decoding without verifying would accept this; the verifier must not. */
    @Test
    void unsignedTokenIsRejected() {
        assertRejected(new PlainJWT(new PlainHeader(), claims().build()).serialize());
    }

    @Test
    void garbageIsRejected() {
        assertRejected("not-a-token");
    }

    @Test
    void unreachableKeysAreAnOutageNotABadToken() throws Exception {
        JWKSource<SecurityContext> down = (selector, context) -> {
            throw new KeySourceException("connection refused");
        };
        String token = sign(claims().build(), GOOGLE_KEY);

        assertThatThrownBy(() -> verifierUsing(down).verify(token)).isInstanceOf(GoogleUnavailableException.class);
    }

    private void assertRejected(String token) {
        assertThatThrownBy(() -> verifier.verify(token)).isInstanceOf(GoogleIdTokenInvalidException.class);
    }

    private static JWTClaimsSet.Builder claims() {
        return new JWTClaimsSet.Builder()
                .issuer("https://accounts.google.com")
                .audience(CLIENT_ID)
                .subject("google-sub-1")
                .issueTime(Date.from(NOW.minusSeconds(60)))
                .expirationTime(Date.from(NOW.plusSeconds(3000)))
                .claim("email", "haru@gmail.com")
                .claim("email_verified", true);
    }

    private static String sign(JWTClaimsSet claims, RSAKey key) throws Exception {
        SignedJWT jwt = new SignedJWT(new JWSHeader.Builder(JWSAlgorithm.RS256).keyID(key.getKeyID()).build(), claims);
        jwt.sign(new RSASSASigner(key));
        return jwt.serialize();
    }

    private static GoogleIdTokenVerifier verifierUsing(JWKSource<SecurityContext> keys) {
        GoogleProperties properties = new GoogleProperties(
                List.of(CLIENT_ID), URI.create("https://www.googleapis.com/oauth2/v3/certs"));
        return new GoogleIdTokenVerifier(keys, properties, Clock.fixed(NOW, ZoneId.of("Asia/Seoul")));
    }

    private static RSAKey generateKey(String keyId) {
        try {
            return new RSAKeyGenerator(2048).keyID(keyId).generate();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

}
