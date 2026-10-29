package com.ssafy.mozzi.domain.gacha.dto;

import jakarta.validation.constraints.Size;

import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.gacha.entity.CardTier;

/**
 * Query of {@code GET /members/me/mozzis}. Every filter is optional.
 *
 * @param name part of the card's name; surrounding spaces are ignored
 * @param sort {@link MyMozziSort#RECENT} when absent
 */
public record MyMozziSearchRequestDto(
        Emotion emotion,
        CardTier tier,
        @Size(max = 30, message = "30자 이하로 입력해 주세요.") String name,
        MyMozziSort sort) {

    public MyMozziSort sortOrDefault() {
        return sort == null ? MyMozziSort.RECENT : sort;
    }

}
