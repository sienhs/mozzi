package com.ssafy.mozzi.domain.image.service;

import com.ssafy.mozzi.domain.image.entity.ImageStatus;

/**
 * Published when a picture reached {@code SUCCEEDED} or {@code FAILED}. Handled after commit,
 * so the app is never told about a result that was rolled back.
 *
 * @param imageUrl {@code null} unless {@code SUCCEEDED}
 */
public record ImageFinishedEvent(Long diaryId, ImageStatus status, String imageUrl) {
}
