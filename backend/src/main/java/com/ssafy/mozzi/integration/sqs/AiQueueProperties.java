package com.ssafy.mozzi.integration.sqs;

import jakarta.validation.constraints.NotBlank;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * The two SQS queues shared with the AI server ({@code infra/terraform/modules/sqs}), under
 * {@code mozzi.ai-queue}.
 *
 * <p>Credentials come from the AWS SDK's default chain, which on EC2 is the instance role.
 *
 * @param requestUrl  {@code ai-request}; blank only outside prod, and requests are then only
 *                    logged
 * @param responseUrl {@code ai-response}; blank only outside prod, and nothing is consumed
 */
@Validated
@ConfigurationProperties("mozzi.ai-queue")
public record AiQueueProperties(String requestUrl, String responseUrl, @NotBlank String region) {

    public boolean sendsRequests() {
        return requestUrl != null && !requestUrl.isBlank();
    }

    public boolean receivesResults() {
        return responseUrl != null && !responseUrl.isBlank();
    }

}
