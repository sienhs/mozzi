package com.ssafy.mozzi.domain.image.dto;

import com.ssafy.mozzi.domain.image.entity.ImageStatus;

/**
 * Data of the {@code image} SSE event: the picture is done or failed.
 *
 * @param imageUrl {@code null} unless {@code SUCCEEDED}
 */
public record DiaryImageEventDto(Long diaryId, ImageStatus status, String imageUrl) {
}
