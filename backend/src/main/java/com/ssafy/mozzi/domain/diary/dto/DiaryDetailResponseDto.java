package com.ssafy.mozzi.domain.diary.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import com.ssafy.mozzi.domain.diary.entity.ActivityCode;
import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.image.entity.ImageStatus;

/**
 * {@code DiaryDetail} from spec 4.4: everything the Diary card and D-01 show.
 *
 * @param activities in chip display order
 * @param memo       what the member wrote, or {@code null}
 * @param title      the image model's title, or {@code null} until the picture is done
 * @param createdAt  D-01 "오후 9:12에 남긴 기록"
 */
public record DiaryDetailResponseDto(
        Long diaryId,
        LocalDate recordDate,
        Emotion emotion,
        List<ActivityCode> activities,
        String memo,
        String title,
        Image image,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {

    /**
     * @param imageUrl          presigned, so short-lived; {@code null} unless the picture is
     *                          done. The app caches by {@code imageId}, not by this URL.
     * @param imageUrlExpiresAt when {@code imageUrl} stops working, or {@code null} with it
     */
    public record Image(Long imageId, ImageStatus status, String imageUrl, OffsetDateTime imageUrlExpiresAt) {
    }

}
