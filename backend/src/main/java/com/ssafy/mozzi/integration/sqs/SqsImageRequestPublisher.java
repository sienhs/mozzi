package com.ssafy.mozzi.integration.sqs;

import com.ssafy.mozzi.domain.image.service.ImageRequestPublisher;

import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.model.SendMessageRequest;
import tools.jackson.databind.ObjectMapper;

/**
 * Sends picture requests to {@code ai-request} as JSON.
 */
class SqsImageRequestPublisher implements ImageRequestPublisher {

    private final SqsClient sqsClient;
    private final String queueUrl;
    private final ObjectMapper objectMapper;

    SqsImageRequestPublisher(SqsClient sqsClient, String queueUrl, ObjectMapper objectMapper) {
        this.sqsClient = sqsClient;
        this.queueUrl = queueUrl;
        this.objectMapper = objectMapper;
    }

    @Override
    public void publish(Message message) {
        sqsClient.sendMessage(SendMessageRequest.builder()
                .queueUrl(queueUrl)
                .messageBody(objectMapper.writeValueAsString(message))
                .build());
    }

}
