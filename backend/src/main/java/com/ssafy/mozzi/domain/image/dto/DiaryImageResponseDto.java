package com.ssafy.mozzi.domain.image.dto;

import com.ssafy.mozzi.domain.image.entity.DiaryImage;
import com.ssafy.mozzi.domain.image.entity.ImageStatus;

/**
 * {@code DiaryImage} from the spec, as shown inside diary responses.
 *
 * @param imageUrl public URL, or {@code null} unless the picture is done
 */
public record DiaryImageResponseDto(ImageStatus status, String imageUrl) {

    /** @return {@code null} for a diary whose picture was never requested */
    public static DiaryImageResponseDto of(DiaryImage image) {
        if (image == null) {
            return null;
        }
        String imageUrl = image.getStatus() == ImageStatus.SUCCEEDED ? image.getImageUrl() : null;
        return new DiaryImageResponseDto(image.getStatus(), imageUrl);
    }

}
