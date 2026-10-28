package com.ssafy.mozzi.domain.emoticon.dto;

import java.util.List;

/**
 * Body of {@code GET /emoticons}. Not paged: there is one emoticon per emotion, five in all.
 */
public record EmoticonListResponseDto(List<EmoticonResponseDto> items) {
}
