package com.ssafy.mozzi.domain.diary.dto;

import java.time.YearMonth;
import jakarta.validation.constraints.NotNull;

import org.springframework.format.annotation.DateTimeFormat;

/**
 * Query of {@code GET /diaries/monthly}.
 *
 * @param yearMonth {@code YYYY-MM}
 */
public record DiaryMonthlyRequestDto(
        @NotNull(message = "조회할 달이 필요해요.") @DateTimeFormat(pattern = "yyyy-MM") YearMonth yearMonth) {
}
