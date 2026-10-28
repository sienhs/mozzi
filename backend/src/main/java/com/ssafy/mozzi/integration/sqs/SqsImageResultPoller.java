package com.ssafy.mozzi.integration.sqs;

import java.time.Duration;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.SmartLifecycle;

import software.amazon.awssdk.services.sqs.SqsClient;
import software.amazon.awssdk.services.sqs.model.DeleteMessageRequest;
import software.amazon.awssdk.services.sqs.model.Message;
import software.amazon.awssdk.services.sqs.model.ReceiveMessageRequest;

/**
 * Long-polls {@code ai-response} on one dedicated thread for the application's lifetime.
 *
 * <p>Not a {@code @Scheduled} job: a receive blocks for up to 20 seconds, which would hold the
 * shared scheduler thread the timeout watchdog and the auth cleanup also run on.
 *
 * <p>A message is deleted only once it is handled. If handling throws (the database is down,
 * say) it stays in the queue and comes back after the visibility timeout. SQS may also deliver
 * a message twice; {@code DiaryImageResultService} applies each outcome only once, so that is
 * harmless.
 */
class SqsImageResultPoller implements SmartLifecycle {

    private static final Logger log = LoggerFactory.getLogger(SqsImageResultPoller.class);

    private static final int WAIT_SECONDS = 20;
    private static final Duration BACKOFF = Duration.ofSeconds(5);

    private final SqsClient sqsClient;
    private final String queueUrl;
    private final ImageResultMessageHandler handler;

    private volatile boolean running;
    private Thread thread;

    SqsImageResultPoller(SqsClient sqsClient, String queueUrl, ImageResultMessageHandler handler) {
        this.sqsClient = sqsClient;
        this.queueUrl = queueUrl;
        this.handler = handler;
    }

    @Override
    public void start() {
        running = true;
        thread = new Thread(this::poll, "sqs-image-result");
        thread.setDaemon(true);
        thread.start();
    }

    @Override
    public void stop() {
        running = false;
        if (thread != null) {
            thread.interrupt();
        }
    }

    @Override
    public boolean isRunning() {
        return running;
    }

    private void poll() {
        ReceiveMessageRequest receive = ReceiveMessageRequest.builder()
                .queueUrl(queueUrl)
                .maxNumberOfMessages(10)
                .waitTimeSeconds(WAIT_SECONDS)
                .build();
        while (running) {
            try {
                for (Message message : sqsClient.receiveMessage(receive).messages()) {
                    handleOne(message);
                }
            } catch (RuntimeException e) {
                if (!running) {
                    return;
                }
                log.error("receiving image results failed; retrying in {}s", BACKOFF.toSeconds(), e);
                sleep();
            }
        }
    }

    private void handleOne(Message message) {
        try {
            if (handler.handle(message.body())) {
                sqsClient.deleteMessage(DeleteMessageRequest.builder()
                        .queueUrl(queueUrl)
                        .receiptHandle(message.receiptHandle())
                        .build());
            }
        } catch (RuntimeException e) {
            log.error("image result not applied; it will be redelivered: messageId={}", message.messageId(), e);
        }
    }

    private void sleep() {
        try {
            Thread.sleep(BACKOFF.toMillis());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            running = false;
        }
    }

}
