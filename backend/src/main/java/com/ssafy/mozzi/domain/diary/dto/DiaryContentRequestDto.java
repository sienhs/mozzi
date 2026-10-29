package com.ssafy.mozzi.domain.diary.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import com.ssafy.mozzi.domain.diary.entity.Diary;

/**
 * Body of {@code PATCH /diaries/{diaryId}/content}.
 *
 * @param content stripped before the length check, the same as when writing the diary
 */
public record DiaryContentRequestDto(
        @NotBlank(message = "한 줄 일기를 입력해 주세요.")
        @Size(max = Diary.CONTENT_MAX_LENGTH, message = "50자 이하로 입력해 주세요.") String content) {

    public DiaryContentRequestDto {
        content = content == null ? null : content.strip();
    }

}
