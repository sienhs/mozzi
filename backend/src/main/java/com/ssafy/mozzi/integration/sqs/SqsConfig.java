package com.ssafy.mozzi.integration.sqs;

import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.autoconfigure.condition.ConditionalOnExpression;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.ssafy.mozzi.domain.image.service.DiaryImageResultService;
import com.ssafy.mozzi.domain.image.service.ImageRequestPublisher;

import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sqs.SqsClient;
import tools.jackson.databind.ObjectMapper;

/**
 * Wires the AI queues when their URLs are set. Without them (local, tests) requests are
 * only logged and no result is consumed; the prod profile requires both.
 */
@Configuration
public class SqsConfig {

    private static final String ANY_QUEUE =
            "'${mozzi.ai-queue.request-url:}' != '' or '${mozzi.ai-queue.response-url:}' != ''";
    private static final String RESPONSE_QUEUE = "'${mozzi.ai-queue.response-url:}' != ''";

    /** Credentials from the default chain: the instance role on EC2. */
    @Bean(destroyMethod = "close")
    @ConditionalOnExpression(ANY_QUEUE)
    SqsClient sqsClient(AiQueueProperties properties) {
        return SqsClient.builder().region(Region.of(properties.region())).build();
    }

    @Bean
    ImageRequestPublisher imageRequestPublisher(
            AiQueueProperties properties, ObjectProvider<SqsClient> sqsClient, ObjectMapper objectMapper) {
        return properties.sendsRequests()
                ? new SqsImageRequestPublisher(sqsClient.getObject(), properties.requestUrl(), objectMapper)
                : new LoggingImageRequestPublisher();
    }

    @Bean
    @ConditionalOnExpression(RESPONSE_QUEUE)
    SqsImageResultPoller sqsImageResultPoller(
            AiQueueProperties properties,
            SqsClient sqsClient,
            DiaryImageResultService resultService,
            ObjectMapper objectMapper) {
        return new SqsImageResultPoller(
                sqsClient, properties.responseUrl(), new ImageResultMessageHandler(resultService, objectMapper));
    }

}
