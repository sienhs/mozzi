package com.ssafy.mozzi.domain.image.service;

/**
 * Published when a picture has been stored as {@code PENDING} and needs a worker.
 *
 * <p>The event is handled after the transaction commits, so a worker can never pick up a
 * request that was rolled back.
 */
public record ImageGenerationRequestedEvent(Long diaryId) {
}
