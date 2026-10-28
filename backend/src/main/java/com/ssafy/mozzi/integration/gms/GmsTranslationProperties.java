package com.ssafy.mozzi.integration.gms;

import jakarta.validation.constraints.NotBlank;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * The picture translator's own setting, read from the same {@code mozzi.gms} block as
 * {@link GmsProperties}: one key and one connection, a different model.
 *
 * <p>Kept apart from {@link GmsProperties} so emotion search's settings and their tests do
 * not change for a feature they do not use.
 *
 * @param translationModel chat model for picture inputs. {@code gpt-4.1-mini} was chosen by
 *                         comparing ten GMS models on diary inputs: the only one with no
 *                         mistranslation that was also among the cheapest and fastest
 */
@Validated
@ConfigurationProperties("mozzi.gms")
public record GmsTranslationProperties(@NotBlank String translationModel) {
}
