package com.ssafy.mozzi.domain.diary.dto;

import java.time.LocalDate;

import com.ssafy.mozzi.domain.diary.entity.Diary;
import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.image.dto.DiaryImageResponseDto;

/**
 * A row of {@code GET /diaries}. Carries the picture URL so a filtered list ("happy days
 * only") can show the pictures; icons are left to the daily view.
 *
 * @param image {@code null} when no picture was requested
 */
public record DiarySummaryResponseDto(
        Long diaryId,
        LocalDate recordDate,
        Long emoticonId,
        Emotion emotion,
        String content,
        DiaryImageResponseDto image) {

    public static DiarySummaryResponseDto of(Diary diary, DiaryImageResponseDto image) {
        return new DiarySummaryResponseDto(
                diary.getId(),
                diary.getRecordDate(),
                diary.getEmoticonId(),
                diary.getEmotion(),
                diary.getContent(),
                image);
    }

}
