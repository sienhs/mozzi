package com.ssafy.mozzi.integration.sqs;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.ssafy.mozzi.domain.image.service.ImageRequestPublisher;

/**
 * Stands in for the queue on a local server or in tests. The request stays {@code PENDING}
 * until the timeout watchdog gives it up. The prod profile has no default queue URL, so this
 * never runs there.
 */
class LoggingImageRequestPublisher implements ImageRequestPublisher {

    private static final Logger log = LoggerFactory.getLogger(LoggingImageRequestPublisher.class);

    @Override
    public void publish(Message message) {
        log.info("no request queue configured; picture request not sent: diaryId={}", message.diaryId());
    }

}
