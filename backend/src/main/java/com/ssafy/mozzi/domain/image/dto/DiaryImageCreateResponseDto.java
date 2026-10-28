package com.ssafy.mozzi.domain.image.dto;

import com.ssafy.mozzi.domain.image.entity.ImageStatus;

/**
 * {@code 202} body of {@code POST /diaries/{diaryId}/image}. The picture itself is made
 * asynchronously.
 */
public record DiaryImageCreateResponseDto(Long diaryId, ImageStatus imageStatus) {
}
