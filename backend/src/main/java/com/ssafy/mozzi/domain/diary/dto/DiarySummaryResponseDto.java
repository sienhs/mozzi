package com.ssafy.mozzi.domain.diary.dto;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.List;

import com.ssafy.mozzi.domain.diary.entity.ActivityCode;
import com.ssafy.mozzi.domain.diary.entity.Diary;
import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.image.entity.ImageStatus;

/**
 * {@code DiarySummary} from spec 4.4: {@code DiaryDetail} without {@code memo},
 * {@code updatedAt} and the image URL. List rows show the emotion face, not the picture, so
 * nothing here needs signing.
 */
public record DiarySummaryResponseDto(
        Long diaryId,
        LocalDate recordDate,
        Emotion emotion,
        List<ActivityCode> activities,
        String title,
        Image image,
        OffsetDateTime createdAt) {

    public record Image(Long imageId, ImageStatus status) {
    }

    public static DiarySummaryResponseDto of(Diary diary, List<ActivityCode> activities) {
        Image image = diary.getCurrentImageId() == null
                ? null
                : new Image(diary.getCurrentImageId(), diary.getImageStatus());
        return new DiarySummaryResponseDto(
                diary.getId(),
                diary.getRecordDate(),
                diary.getEmotion(),
                activities,
                diary.getTitle(),
                image,
                diary.getCreatedAt());
    }

}
