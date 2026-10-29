package com.ssafy.mozzi.domain.diary.dto;

/**
 * {@code 200} body of {@code PATCH /diaries/{diaryId}/content}.
 */
public record DiaryContentResponseDto(Long diaryId, String content) {
}
