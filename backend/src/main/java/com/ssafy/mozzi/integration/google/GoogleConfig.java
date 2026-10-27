package com.ssafy.mozzi.integration.google;

import java.net.MalformedURLException;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.nimbusds.jose.jwk.source.JWKSource;
import com.nimbusds.jose.jwk.source.JWKSourceBuilder;
import com.nimbusds.jose.proc.SecurityContext;

@Configuration
public class GoogleConfig {

    /**
     * Google's signing keys, fetched on first use and cached.
     *
     * <p>The builder's defaults cache the key set, refresh it ahead of expiry and refetch
     * when a token names a key id it has not seen, which is how Google's key rotation is
     * picked up. {@code retrying} retries a failed fetch once before giving up.
     */
    @Bean
    JWKSource<SecurityContext> googleJwkSource(GoogleProperties properties) throws MalformedURLException {
        return JWKSourceBuilder.<SecurityContext>create(properties.jwksUri().toURL())
                .retrying(true)
                .build();
    }

}
