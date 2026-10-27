package com.ssafy.mozzi.domain.auth.service;

import java.time.OffsetDateTime;

/** A fresh access/refresh pair, handed to the app together. */
public record IssuedTokens(
        String accessToken,
        OffsetDateTime accessExpiresAt,
        String refreshToken,
        OffsetDateTime refreshExpiresAt) {
}
