package com.ssafy.mozzi.global.security;

import java.time.Duration;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Token settings under {@code mozzi.auth}.
 *
 * @param issuer          {@code iss} of the access tokens this server signs
 * @param audience        {@code aud} of the same tokens
 * @param jwtSecret       HS256 key, at least 32 bytes. Injected from a Secret, never committed
 * @param accessTokenTtl  lifetime of an access token (30 minutes)
 * @param refreshTokenTtl lifetime of a refresh token, counted again from every refresh (30 days)
 * @param signupTicketTtl how long a new user has to submit a nickname (10 minutes)
 */
@Validated
@ConfigurationProperties("mozzi.auth")
public record AuthProperties(
        @NotBlank String issuer,
        @NotBlank String audience,
        @NotBlank String jwtSecret,
        @NotNull Duration accessTokenTtl,
        @NotNull Duration refreshTokenTtl,
        @NotNull Duration signupTicketTtl) {

    /** Keeps {@code jwtSecret} out of anything that prints the bound properties. */
    @Override
    public String toString() {
        return "AuthProperties[issuer=" + issuer + ", audience=" + audience
                + ", accessTokenTtl=" + accessTokenTtl + ", refreshTokenTtl=" + refreshTokenTtl
                + ", signupTicketTtl=" + signupTicketTtl + "]";
    }

}
