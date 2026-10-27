package com.ssafy.mozzi.domain.diary.dto;

import java.time.LocalDate;

import com.ssafy.mozzi.domain.image.entity.ImageStatus;

/**
 * {@code 201} body of {@code POST /diaries} (spec 4.4). The app moves to G-01 on receipt and
 * polls the image by {@code image.imageId}.
 *
 * <p>{@code reward} from the spec is left out until the gacha ticket tables exist.
 */
public record DiaryCreateResponseDto(Long diaryId, LocalDate recordDate, Image image) {

    public record Image(Long imageId, ImageStatus status) {
    }

}
