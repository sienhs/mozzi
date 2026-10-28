package com.ssafy.mozzi.domain.home.dto;

import java.time.LocalDate;

import com.ssafy.mozzi.domain.diary.dto.DiaryDetailResponseDto;

/**
 * Body of {@code GET /home}.
 *
 * @param today           the server's date (Asia/Seoul), the one a diary saved now would get
 * @param todayDiary      {@code null} when today is not written yet
 * @param canRequestImage whether E-01 shows its button: {@code POST /diaries/{id}/image} would
 *                        have been accepted as of this read. Midnight or another device can
 *                        still get there first, so the request may yet be refused
 * @param recentDiary     the latest diary before today, or {@code null}; H-01's "지난 기록"
 */
public record HomeResponseDto(
        LocalDate today,
        TodayStatus todayStatus,
        DiaryDetailResponseDto todayDiary,
        boolean canRequestImage,
        DiaryDetailResponseDto recentDiary) {
}
