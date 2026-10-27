package com.ssafy.mozzi.integration.google;

import java.net.URI;
import java.util.List;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Google sign-in settings under {@code mozzi.google}.
 *
 * @param clientIds OAuth client ids an ID token may be issued for ({@code aud}). The Android
 *                  app requests its token for the server's Web client id, so that id belongs
 *                  here; a comma-separated environment variable binds to the list
 * @param jwksUri   where Google publishes the keys it signs ID tokens with
 */
@Validated
@ConfigurationProperties("mozzi.google")
public record GoogleProperties(@NotEmpty List<String> clientIds, @NotNull URI jwksUri) {
}
