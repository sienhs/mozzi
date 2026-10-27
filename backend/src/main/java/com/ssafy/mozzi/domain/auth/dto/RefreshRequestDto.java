package com.ssafy.mozzi.domain.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * {@code POST /auth/refresh}. The refresh token travels only in this body — never in a
 * header of other requests, a URL or a query string.
 */
public record RefreshRequestDto(@NotBlank @Size(max = 128) String refreshToken) {
}
