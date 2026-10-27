package com.ssafy.mozzi.integration.google;

import java.text.ParseException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Date;
import java.util.List;
import java.util.Set;

import org.springframework.stereotype.Component;

import com.nimbusds.jose.JOSEException;
import com.nimbusds.jose.JWSAlgorithm;
import com.nimbusds.jose.KeySourceException;
import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.proc.BadJOSEException;
import com.nimbusds.jose.proc.JWSVerificationKeySelector;
import com.nimbusds.jose.proc.SecurityContext;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.proc.BadJWTException;
import com.nimbusds.jwt.proc.ConfigurableJWTProcessor;
import com.nimbusds.jwt.proc.DefaultJWTProcessor;

/**
 * Verifies a Google ID token the way Google's server-side guide asks: RS256 signature against
 * Google's published keys, {@code iss}, {@code aud} against our client ids, and {@code exp}.
 * Decoding the token without checking the signature is not verification.
 *
 * <p>The signing keys are fetched and cached by the {@link JWKSource} (see
 * {@link GoogleConfig}), so an ordinary login does not call Google; only key rotation does.
 *
 * <p>Expiry is checked against the {@link Clock} bean rather than the library's own machine
 * time, so tests can move it.
 */
@Component
public class GoogleIdTokenVerifier {

    /** Google issues ID tokens under either spelling. */
    private static final Set<String> ISSUERS = Set.of("accounts.google.com", "https://accounts.google.com");

    /** Tolerance for the difference between Google's clock and ours. */
    private static final Duration CLOCK_SKEW = Duration.ofSeconds(60);

    private final ConfigurableJWTProcessor<SecurityContext> processor;
    private final List<String> clientIds;
    private final Clock clock;

    public GoogleIdTokenVerifier(JWKSource<SecurityContext> googleJwkSource, GoogleProperties properties,
            Clock clock) {
        this.clientIds = List.copyOf(properties.clientIds());
        this.clock = clock;
        this.processor = new DefaultJWTProcessor<>();
        // Only RS256 is accepted, whatever the token's header claims.
        this.processor.setJWSKeySelector(new JWSVerificationKeySelector<>(JWSAlgorithm.RS256, googleJwkSource));
        this.processor.setJWTClaimsSetVerifier((claims, context) -> verifyClaims(claims));
    }

    /**
     * @throws GoogleIdTokenInvalidException the token is not a valid Google ID token for this app
     * @throws GoogleUnavailableException    Google's keys could not be fetched; says nothing
     *                                       about the token
     */
    public GoogleIdentity verify(String idToken) {
        JWTClaimsSet claims;
        try {
            claims = processor.process(idToken, null);
        } catch (KeySourceException e) {
            // A subclass of JOSEException, so it has to be caught first: this one is an
            // outage on our side, not a bad token.
            throw new GoogleUnavailableException(e);
        } catch (ParseException | BadJOSEException | JOSEException e) {
            throw new GoogleIdTokenInvalidException(e.getMessage(), e);
        }
        return new GoogleIdentity(claims.getSubject(), verifiedEmail(claims));
    }

    private void verifyClaims(JWTClaimsSet claims) throws BadJWTException {
        if (!ISSUERS.contains(claims.getIssuer())) {
            throw new BadJWTException("unexpected issuer");
        }
        List<String> audience = claims.getAudience();
        if (audience == null || audience.stream().noneMatch(clientIds::contains)) {
            throw new BadJWTException("unexpected audience");
        }
        Date expiresAt = claims.getExpirationTime();
        if (expiresAt == null || claims.getIssueTime() == null) {
            throw new BadJWTException("missing exp or iat");
        }
        Instant now = clock.instant();
        if (!now.minus(CLOCK_SKEW).isBefore(expiresAt.toInstant())) {
            throw new BadJWTException("expired");
        }
        String subject = claims.getSubject();
        if (subject == null || subject.isBlank()) {
            throw new BadJWTException("missing sub");
        }
    }

    private static String verifiedEmail(JWTClaimsSet claims) {
        try {
            String email = claims.getStringClaim("email");
            Boolean verified = claims.getBooleanClaim("email_verified");
            if (email == null || email.isBlank() || !Boolean.TRUE.equals(verified)) {
                return null;
            }
            return email;
        } catch (ParseException e) {
            // A claim of the wrong type: treat the email as unknown rather than reject a token
            // whose identity (sub) is fine.
            return null;
        }
    }

}
