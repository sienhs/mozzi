package com.ssafy.mozzi.domain.diary.dto;

import java.time.LocalDate;

import com.ssafy.mozzi.domain.wallet.dto.RewardResponseDto;

/**
 * {@code 201} body of {@code POST /diaries}. No picture yet: the app requests it separately.
 *
 * @param reward the day's diary reward paid with this save, or {@code null} when the date was
 *               already rewarded
 */
public record DiaryCreateResponseDto(Long diaryId, LocalDate recordDate, RewardResponseDto reward) {
}
