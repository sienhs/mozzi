package com.ssafy.mozzi.domain.diary.dto;

import java.util.List;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.hibernate.validator.constraints.UniqueElements;

import com.ssafy.mozzi.domain.diary.entity.ActivityCode;
import com.ssafy.mozzi.domain.diary.entity.Emotion;

/**
 * Body of {@code PATCH /diaries/{diaryId}} (spec 4.4): only the fields being changed.
 *
 * <p>A field that is missing or {@code null} is left as it is. To clear the memo, send an
 * empty string; to clear the activities, send an empty list. The record date cannot be
 * changed — an unknown field is rejected with 400 rather than ignored.
 */
public record DiaryUpdateRequestDto(
        Emotion emotion,
        @UniqueElements(message = "같은 활동을 두 번 고를 수 없어요.") List<@NotNull ActivityCode> activities,
        @Size(max = DiaryMemo.MAX_LENGTH, message = DiaryMemo.TOO_LONG) String memo) {

    public DiaryUpdateRequestDto {
        // Stripped here, not in normalizedMemo(), so the length check sees the same text as
        // on create. An empty result is kept as "" because it means "clear the memo".
        memo = memo == null ? null : memo.strip();
    }

    /** Normalised memo to store: {@code null} clears it. Only meaningful when {@link #changesMemo()}. */
    public String normalizedMemo() {
        return DiaryMemo.normalize(memo);
    }

    public boolean changesMemo() {
        return memo != null;
    }

}
