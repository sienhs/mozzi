package com.ssafy.mozzi.domain.diary.dto;

import java.time.LocalDate;
import java.util.List;

import com.ssafy.mozzi.domain.diary.entity.Diary;
import com.ssafy.mozzi.domain.diary.entity.Emotion;

/**
 * Body of {@code GET /diaries/monthly}, the calendar.
 *
 * <p>Not paged (convention 4.5): the query is bounded to one month, so there are at most 31
 * items, one per day written. Days without a diary are left out and drawn empty by the app.
 *
 * @param yearMonth {@code YYYY-MM}, as requested
 */
public record DiaryMonthlyResponseDto(String yearMonth, List<Item> items) {

    public record Item(Long diaryId, LocalDate recordDate, Long emoticonId, Emotion emotion) {

        public static Item of(Diary diary) {
            return new Item(diary.getId(), diary.getRecordDate(), diary.getEmoticonId(), diary.getEmotion());
        }

    }

}
