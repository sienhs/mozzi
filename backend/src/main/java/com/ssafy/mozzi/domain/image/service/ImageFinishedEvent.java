package com.ssafy.mozzi.domain.image.service;

import com.ssafy.mozzi.domain.image.entity.ImageStatus;
import com.ssafy.mozzi.domain.image.exception.ImageErrorCode;

/**
 * Published when a picture reached {@code SUCCEEDED} or {@code FAILED}. Handled after commit
 * ({@link ImagePushListener}), so the member is never told about a result that was rolled
 * back.
 *
 * @param imageUrl {@code null} unless {@code SUCCEEDED}
 * @param reason   why it failed, when that is something the member can act on; otherwise
 *                 {@code null}
 */
public record ImageFinishedEvent(Long diaryId, ImageStatus status, String imageUrl, ImageErrorCode reason) {
}
