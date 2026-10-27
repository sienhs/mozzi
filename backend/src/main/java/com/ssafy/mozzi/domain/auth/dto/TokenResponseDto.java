package com.ssafy.mozzi.domain.auth.dto;

import java.time.OffsetDateTime;

import com.ssafy.mozzi.domain.auth.service.IssuedTokens;

/** A new token pair; the app stores both together, replacing the old pair. */
public record TokenResponseDto(
        String accessToken,
        String refreshToken,
        OffsetDateTime accessExpiresAt,
        OffsetDateTime refreshExpiresAt) {

    public static TokenResponseDto from(IssuedTokens tokens) {
        return new TokenResponseDto(tokens.accessToken(), tokens.refreshToken(),
                tokens.accessExpiresAt(), tokens.refreshExpiresAt());
    }

}
