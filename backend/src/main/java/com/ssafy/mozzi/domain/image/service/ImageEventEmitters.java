package com.ssafy.mozzi.domain.image.service;

import java.io.IOException;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import com.ssafy.mozzi.domain.image.dto.DiaryImageEventDto;

/**
 * Open SSE connections waiting for a diary's picture, one per diary.
 *
 * <p>The app subscribes before it sends the picture request, so the result cannot arrive
 * before anyone is listening. The connection is closed once the result is sent.
 *
 * <p>Held in memory, which is enough for the single EC2 instance this runs on. With a second
 * instance, a result consumed by one could not reach a connection held by the other.
 */
@Component
public class ImageEventEmitters {

    static final String EVENT_CONNECTED = "connected";
    static final String EVENT_IMAGE = "image";

    private static final Logger log = LoggerFactory.getLogger(ImageEventEmitters.class);

    private final Map<Long, SseEmitter> emitters = new ConcurrentHashMap<>();
    private final Duration timeout;

    public ImageEventEmitters(ImageProperties properties) {
        this.timeout = properties.eventStreamTimeout();
    }

    /**
     * Opens a connection for the diary. A second subscription for the same diary (the app
     * reconnecting) replaces the first.
     */
    public SseEmitter subscribe(Long diaryId) {
        SseEmitter emitter = new SseEmitter(timeout.toMillis());
        emitter.onCompletion(() -> emitters.remove(diaryId, emitter));
        emitter.onTimeout(() -> emitters.remove(diaryId, emitter));
        emitter.onError(e -> emitters.remove(diaryId, emitter));
        SseEmitter previous = emitters.put(diaryId, emitter);
        if (previous != null) {
            previous.complete();
        }
        log.info("image pipeline: step=subscribed diaryId={} replaced={}", diaryId, previous != null);
        // Sends the response headers now; without a first event some proxies hold the
        // stream until data arrives, and the app cannot tell it is connected.
        send(diaryId, emitter, SseEmitter.event().name(EVENT_CONNECTED).data("ok"));
        return emitter;
    }

    @TransactionalEventListener
    public void onFinished(ImageFinishedEvent event) {
        SseEmitter emitter = emitters.remove(event.diaryId());
        if (emitter == null) {
            log.info("image pipeline: step=not-notified reason=no-subscriber diaryId={}", event.diaryId());
            return;
        }
        DiaryImageEventDto body = new DiaryImageEventDto(event.diaryId(), event.status(), event.imageUrl());
        if (send(event.diaryId(), emitter, SseEmitter.event().name(EVENT_IMAGE).data(body, MediaType.APPLICATION_JSON))) {
            log.info("image pipeline: step=notified diaryId={} status={}", event.diaryId(), event.status());
            emitter.complete();
        }
    }

    private boolean send(Long diaryId, SseEmitter emitter, SseEmitter.SseEventBuilder event) {
        try {
            emitter.send(event);
            return true;
        } catch (IOException | IllegalStateException e) {
            // The app went away; it reads the result from the daily view when it comes back.
            log.warn("image pipeline: step=not-notified reason=connection-closed diaryId={}", diaryId);
            emitters.remove(diaryId, emitter);
            emitter.completeWithError(e);
            return false;
        }
    }

}
