package com.ssafy.mozzi.domain.icon.dto;

import java.time.OffsetDateTime;

import com.ssafy.mozzi.domain.icon.entity.IconCategory;
import com.ssafy.mozzi.domain.icon.entity.MyIcon;

/**
 * {@code MyIcon} from the spec.
 */
public record MyIconResponseDto(Long myIconId, String name, IconCategory category, OffsetDateTime createdAt) {

    public static MyIconResponseDto of(MyIcon myIcon) {
        return new MyIconResponseDto(myIcon.getId(), myIcon.getName(), myIcon.getCategory(), myIcon.getCreatedAt());
    }

}
