package com.ssafy.mozzi.integration.gms;

import java.net.URI;
import java.time.Duration;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * SSAFY GMS settings under {@code mozzi.gms}. GMS is an OpenAI-compatible proxy, so pointing
 * {@code baseUrl} at OpenAI itself is the only change a provider switch needs.
 *
 * @param baseUrl             up to and including {@code /v1}
 * @param apiKey              sent as a bearer token
 * @param chatModel           model for the Responses API
 * @param reasoningEffort     {@code none} for gpt-6-luna: it reads a question just as well
 *                            without reasoning and answers with 60% fewer output tokens
 *                            (measured). It rejects {@code minimal}
 * @param maxOutputTokens     upper bound per answer, so a runaway answer cannot run up cost
 * @param embeddingModel      model for the embeddings API
 * @param embeddingDimensions requested with every call; must match
 *                            {@code diary_embedding.embedding} ({@code vector(1536)})
 * @param connectTimeout      time to open the connection
 * @param readTimeout         time to wait for the answer of one call. Emotion search makes
 *                            two calls in a row within its 10 seconds (spec), and a
 *                            Responses call took 2.3-4.1 seconds through GMS (measured)
 */
@Validated
@ConfigurationProperties("mozzi.gms")
public record GmsProperties(
        @NotNull URI baseUrl,
        @NotBlank String apiKey,
        @NotBlank String chatModel,
        @NotBlank String reasoningEffort,
        @Positive int maxOutputTokens,
        @NotBlank String embeddingModel,
        @Positive int embeddingDimensions,
        @NotNull Duration connectTimeout,
        @NotNull Duration readTimeout) {

    /**
     * What {@code diary_embedding.model} stores. The dimensions are part of it because a
     * vector cut to 1024 does not compare with one cut to 1536, even from the same model.
     */
    public String embeddingModelId() {
        return embeddingModel + "@" + embeddingDimensions;
    }

}
