package com.ssafy.mozzi.domain.icon.dto;

import java.util.List;

/**
 * Body of {@code GET /icons}. Not paged: the base images are a fixed set of about twenty.
 */
public record IconListResponseDto(List<IconResponseDto> items) {
}
