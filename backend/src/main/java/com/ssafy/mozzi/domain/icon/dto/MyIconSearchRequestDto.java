package com.ssafy.mozzi.domain.icon.dto;

import jakarta.validation.constraints.NotNull;

import com.ssafy.mozzi.domain.icon.entity.IconCategory;

/**
 * Query of {@code GET /my-icons}. The app shows one category at a time, so it is required.
 */
public record MyIconSearchRequestDto(@NotNull(message = "카테고리를 골라 주세요.") IconCategory category) {
}
