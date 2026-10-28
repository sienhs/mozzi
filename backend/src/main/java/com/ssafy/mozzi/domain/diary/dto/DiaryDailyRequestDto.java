package com.ssafy.mozzi.domain.diary.dto;

import java.time.LocalDate;
import jakarta.validation.constraints.NotNull;

import org.springframework.format.annotation.DateTimeFormat;

/**
 * Query of {@code GET /diaries/daily}.
 */
public record DiaryDailyRequestDto(
        @NotNull(message = "날짜가 필요해요.") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
}
