package com.ssafy.mozzi.domain.image.dto;

import jakarta.validation.constraints.NotNull;

import com.ssafy.mozzi.domain.image.entity.TimeOfDay;

/**
 * Body of {@code POST /diaries/{diaryId}/image}.
 *
 * <p>Each icon must be one of the diary's own icons in the matching category. That needs the
 * diary, so it is checked by the service rather than here.
 *
 * @param timeOfDay     optional
 * @param whereMyIconId optional
 * @param whoMyIconId   optional
 */
public record DiaryImageCreateRequestDto(
        @NotNull(message = "모찌를 골라 주세요.") Long characterId,
        TimeOfDay timeOfDay,
        Long whereMyIconId,
        Long whoMyIconId,
        @NotNull(message = "무엇을 했는지 골라 주세요.") Long whatMyIconId) {
}
