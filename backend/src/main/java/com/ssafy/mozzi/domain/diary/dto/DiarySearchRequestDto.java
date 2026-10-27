package com.ssafy.mozzi.domain.diary.dto;

import java.time.LocalDate;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import org.springframework.format.annotation.DateTimeFormat;

import com.ssafy.mozzi.domain.diary.entity.ActivityCode;
import com.ssafy.mozzi.domain.diary.entity.Emotion;

/**
 * Query of {@code GET /diaries} (spec 4.4, convention 4.2). Every filter is optional.
 *
 * @param cursor {@code nextCursor} of the previous page; absent for the first page
 * @param size   page size, 20 when absent, at most 100
 * @param from   inclusive
 * @param to     inclusive
 */
public record DiarySearchRequestDto(
        String cursor,
        @Min(value = 1, message = "1 이상이어야 해요.") @Max(value = 100, message = "100 이하로 요청해 주세요.") Integer size,
        Emotion emotion,
        ActivityCode activity,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
        @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {

    public static final int DEFAULT_SIZE = 20;

    public int sizeOrDefault() {
        return size == null ? DEFAULT_SIZE : size;
    }

}
