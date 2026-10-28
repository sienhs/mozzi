package com.ssafy.mozzi.domain.diary.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.icon.dto.MyIconResponseDto;
import com.ssafy.mozzi.domain.icon.entity.IconCategory;
import com.ssafy.mozzi.domain.image.dto.DiaryImageResponseDto;

/**
 * Body of {@code GET /diaries/daily}: everything one day's screen shows.
 *
 * @param content what the member wrote, or {@code null}
 * @param myIcons grouped by category; all three keys are always present, empty when the
 *                diary has none left in that category
 * @param image   {@code null} until a picture is requested
 */
public record DiaryDetailResponseDto(
        Long diaryId,
        LocalDate recordDate,
        Long emoticonId,
        Emotion emotion,
        String content,
        Map<IconCategory, List<MyIconResponseDto>> myIcons,
        DiaryImageResponseDto image,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {
}
