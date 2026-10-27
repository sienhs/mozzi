package com.ssafy.mozzi.domain.image.service;

/**
 * Published when an attempt has been stored as {@code PENDING} and needs a worker.
 *
 * <p>Saving a diary and queueing its picture are separate on purpose (spec 4.5): the event
 * is handled after the transaction commits, so a worker can never pick up an attempt whose
 * diary was rolled back.
 */
public record ImageGenerationRequestedEvent(Long diaryImageId) {
}
