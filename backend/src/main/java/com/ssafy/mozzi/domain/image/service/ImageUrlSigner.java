package com.ssafy.mozzi.domain.image.service;

import java.time.OffsetDateTime;
import java.util.Optional;

/**
 * Turns a private S3 key into a short-lived URL (spec 1, ten minutes).
 *
 * <p>URLs are signed on every read and never stored, which is why responses carry
 * {@code imageUrlExpiresAt} and the app re-fetches the diary after a 403.
 */
public interface ImageUrlSigner {

    /**
     * @return the signed URL, or empty when no URL can be issued right now
     */
    Optional<SignedUrl> sign(String imageKey);

    record SignedUrl(String url, OffsetDateTime expiresAt) {
    }

}
