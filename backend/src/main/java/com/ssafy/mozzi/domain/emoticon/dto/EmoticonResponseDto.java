package com.ssafy.mozzi.domain.emoticon.dto;

import com.ssafy.mozzi.domain.diary.entity.Emotion;
import com.ssafy.mozzi.domain.emoticon.entity.Emoticon;

public record EmoticonResponseDto(Long emoticonId, Emotion emotion, String imageUrl) {

    public static EmoticonResponseDto of(Emoticon emoticon) {
        return new EmoticonResponseDto(emoticon.getId(), emoticon.getEmotion(), emoticon.getImageUrl());
    }

}
