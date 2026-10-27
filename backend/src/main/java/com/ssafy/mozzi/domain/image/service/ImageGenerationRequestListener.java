package com.ssafy.mozzi.domain.image.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Hands committed attempts to the image worker.
 *
 * <p>Placeholder: the queue (SQS, Redis Streams or a DB outbox) has not been chosen, so for
 * now the attempt is only logged and stays {@code PENDING}. Once the queue exists, this is
 * the one place that sends to it; nothing on the diary side has to change.
 */
@Component
public class ImageGenerationRequestListener {

    private static final Logger log = LoggerFactory.getLogger(ImageGenerationRequestListener.class);

    @TransactionalEventListener
    public void onRequested(ImageGenerationRequestedEvent event) {
        log.info("image generation requested, no queue wired yet: diaryImageId={}", event.diaryImageId());
    }

}
