package com.ssafy.mozzi.domain.member.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import com.ssafy.mozzi.domain.member.entity.PushPlatform;

/**
 * Body of {@code PUT /members/me/push-tokens}.
 *
 * @param token    the FCM registration token
 * @param deviceId a UUID the app makes once and keeps, so the same device overwrites its row
 */
public record PushTokenRegisterRequestDto(
        @NotBlank @Size(max = 512) String token,
        @NotNull PushPlatform platform,
        @NotBlank @Size(max = 64) String deviceId) {
}
