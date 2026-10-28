package com.ssafy.mozzi.domain.image.service;

import java.time.Duration;
import jakarta.validation.constraints.NotNull;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Picture settings under {@code mozzi.image}.
 *
 * @param eventStreamTimeout       how long the SSE connection waits for the result; after
 *                                 that the app reads it from the daily view instead
 * @param defaultCharacterImageUrl sent for every request until the character table exists;
 *                                 the {@code characterId} the member picked is stored but not
 *                                 looked up yet. Optional
 * @param defaultCharacterPrompt   the character's description, translated with the rest
 * @param translate                translate inputs with GMS; off where there is no real key
 */
@Validated
@ConfigurationProperties("mozzi.image")
public record ImageProperties(
        @NotNull Duration eventStreamTimeout,
        String defaultCharacterImageUrl,
        String defaultCharacterPrompt,
        boolean translate) {
}
