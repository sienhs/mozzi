package com.ssafy.mozzi.domain.diary.dto;

import java.util.List;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.hibernate.validator.constraints.UniqueElements;

import com.ssafy.mozzi.domain.diary.entity.Diary;

/**
 * Body of {@code POST /diaries}.
 *
 * <p>No date: the server files the diary under today. Whether the icons are the member's own
 * and include a {@code WHAT} needs the database, so that is checked by the service.
 *
 * @param content optional; stripped before the length check, blank counts as absent
 */
public record DiaryCreateRequestDto(
        @NotNull(message = "기분을 골라 주세요.") Long emoticonId,
        @Size(max = Diary.CONTENT_MAX_LENGTH, message = "50자 이하로 입력해 주세요.") String content,
        @NotNull(message = DiaryCreateRequestDto.WHAT_REQUIRED)
        @UniqueElements(message = "같은 아이콘을 두 번 고를 수 없어요.") List<@NotNull Long> myIconIds) {

    public static final String WHAT_REQUIRED = "무엇을 했는지 하나 이상 골라 주세요.";

    public DiaryCreateRequestDto {
        content = normalize(content);
    }

    /**
     * Strips surrounding whitespace before the length check, and treats a content that is
     * empty afterwards as none, so a line of spaces is not stored as a diary.
     */
    private static String normalize(String content) {
        if (content == null) {
            return null;
        }
        String stripped = content.strip();
        return stripped.isEmpty() ? null : stripped;
    }

}
