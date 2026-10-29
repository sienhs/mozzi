package com.ssafy.mozzi.domain.gacha.service;

import jakarta.validation.constraints.NotBlank;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Gacha settings, under {@code mozzi.gacha}.
 *
 * @param imageBaseUrl prefix of every card image; a card's URL is this, a slash and its
 *                     {@code image_key}. No trailing slash.
 */
@Validated
@ConfigurationProperties("mozzi.gacha")
public record GachaProperties(@NotBlank String imageBaseUrl) {

    public String imageUrl(String imageKey) {
        return imageBaseUrl + "/" + imageKey;
    }

}
