package com.ssafy.mozzi.domain.image.service;

/**
 * Published when a picture has been stored as {@code PENDING} and needs a worker.
 *
 * <p>The event is handled after the transaction commits, so a worker can never pick up a
 * request that was rolled back.
 *
 * @param test from the temporary test API: the AI server stores the picture under
 *             {@code test/} instead (S15P31D102-132)
 */
public record ImageGenerationRequestedEvent(Long diaryId, boolean test) {

    public ImageGenerationRequestedEvent(Long diaryId) {
        this(diaryId, false);
    }

}
