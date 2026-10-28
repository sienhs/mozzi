package com.ssafy.mozzi.domain.search.service;

import java.time.Duration;
import jakarta.validation.constraints.NotNull;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * Emotion search settings under {@code mozzi.search}.
 *
 * @param timeBudget how long one question may take end to end; past it the question answers
 *                   503 (spec: 10 seconds)
 */
@Validated
@ConfigurationProperties("mozzi.search")
public record SearchProperties(@NotNull Duration timeBudget) {
}
