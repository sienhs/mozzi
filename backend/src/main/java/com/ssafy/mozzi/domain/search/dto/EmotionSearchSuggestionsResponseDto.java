package com.ssafy.mozzi.domain.search.dto;

import java.util.List;

/** {@code GET /emotion-search/suggestions} (S-01). */
public record EmotionSearchSuggestionsResponseDto(List<String> suggestions) {
}
