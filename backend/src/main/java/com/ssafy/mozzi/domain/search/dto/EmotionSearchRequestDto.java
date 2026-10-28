package com.ssafy.mozzi.domain.search.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/** {@code POST /emotion-search}. */
public record EmotionSearchRequestDto(@NotBlank @Size(max = 200) String question) {
}
