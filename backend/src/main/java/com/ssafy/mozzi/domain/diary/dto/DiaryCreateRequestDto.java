package com.ssafy.mozzi.domain.diary.dto;

import java.time.LocalDate;
import java.util.List;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.hibernate.validator.constraints.UniqueElements;

import com.ssafy.mozzi.domain.diary.entity.ActivityCode;
import com.ssafy.mozzi.domain.diary.entity.Emotion;

/**
 * Body of {@code POST /diaries} (spec 4.4).
 *
 * <p>Which dates are allowed depends on the clock, so that rule is checked by
 * {@code RecordDatePolicy} rather than by an annotation here.
 *
 * @param activities zero or more, no repeats; zero is allowed (policy 2), and a missing
 *                   field means none
 * @param memo       optional; stripped before the length check, blank counts as absent
 */
public record DiaryCreateRequestDto(
        @NotNull(message = "기록할 날짜가 필요해요.") LocalDate recordDate,
        @NotNull(message = "기분을 골라 주세요.") Emotion emotion,
        @UniqueElements(message = "같은 활동을 두 번 고를 수 없어요.") List<@NotNull ActivityCode> activities,
        @Size(max = DiaryMemo.MAX_LENGTH, message = DiaryMemo.TOO_LONG) String memo) {

    public DiaryCreateRequestDto {
        activities = activities == null ? List.of() : activities;
        memo = DiaryMemo.normalize(memo);
    }

}
