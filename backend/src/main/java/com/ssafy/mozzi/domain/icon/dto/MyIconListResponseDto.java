package com.ssafy.mozzi.domain.icon.dto;

import java.util.List;

/**
 * Body of {@code GET /my-icons}. Not paged: one category holds at most
 * {@link com.ssafy.mozzi.domain.icon.entity.MyIcon#MAX_PER_CATEGORY} icons.
 */
public record MyIconListResponseDto(List<MyIconResponseDto> items) {
}
