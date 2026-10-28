package com.ssafy.mozzi.domain.diary.dto;

import java.time.LocalDate;

/**
 * {@code 201} body of {@code POST /diaries}. No picture yet: the app requests it separately.
 *
 * <p>{@code reward} from the spec is left out until the gacha ticket tables exist.
 */
public record DiaryCreateResponseDto(Long diaryId, LocalDate recordDate) {
}
