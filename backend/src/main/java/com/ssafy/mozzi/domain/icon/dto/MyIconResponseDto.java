package com.ssafy.mozzi.domain.icon.dto;

import java.time.OffsetDateTime;

import com.ssafy.mozzi.domain.icon.entity.IconCategory;
import com.ssafy.mozzi.domain.icon.entity.MyIcon;

/**
 * {@code MyIcon} from the spec.
 *
 * @param imageUrl the base image's public URL
 */
public record MyIconResponseDto(
        Long myIconId, Long iconId, String imageUrl, String name, IconCategory category, OffsetDateTime createdAt) {

    /** Reads the base image, so load the icon together with it. */
    public static MyIconResponseDto of(MyIcon myIcon) {
        return new MyIconResponseDto(
                myIcon.getId(),
                myIcon.getIcon().getId(),
                myIcon.getIcon().getImageUrl(),
                myIcon.getName(),
                myIcon.getCategory(),
                myIcon.getCreatedAt());
    }

}
