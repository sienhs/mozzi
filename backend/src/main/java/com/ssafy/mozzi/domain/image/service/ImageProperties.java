package com.ssafy.mozzi.domain.image.service;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Picture settings under {@code mozzi.image}.
 *
 * @param defaultCharacterImageUrl sent for every request until the character table exists;
 *                                 the {@code characterId} the member picked is stored but not
 *                                 looked up yet. Optional
 * @param defaultCharacterPrompt   the character's description in English, sent as is: it is
 *                                 the same for every picture, so it is not translated. Sent
 *                                 only with a character image URL; without one the AI server
 *                                 draws its own default character and gets {@code ""}
 * @param translate                translate inputs with GMS; off where there is no real key
 */
@Validated
@ConfigurationProperties("mozzi.image")
public record ImageProperties(
        String defaultCharacterImageUrl,
        String defaultCharacterPrompt,
        boolean translate) {
}
