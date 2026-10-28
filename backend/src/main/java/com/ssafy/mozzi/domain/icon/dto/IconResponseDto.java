package com.ssafy.mozzi.domain.icon.dto;

import com.ssafy.mozzi.domain.icon.entity.Icon;

public record IconResponseDto(Long iconId, String imageUrl) {

    public static IconResponseDto of(Icon icon) {
        return new IconResponseDto(icon.getId(), icon.getImageUrl());
    }

}
