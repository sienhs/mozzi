package com.ssafy.mozzi.domain.gacha.dto;

import com.ssafy.mozzi.domain.diary.entity.Emotion;

/**
 * One emotion on the my page.
 *
 * @param selected the picked mozzi, or {@code null} when none is: the app shows its default
 */
public record MyMozziResponseDto(Emotion emotion, MyMozziCardResponseDto selected) {
}
