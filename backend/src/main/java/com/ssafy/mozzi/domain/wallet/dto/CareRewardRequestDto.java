package com.ssafy.mozzi.domain.wallet.dto;

import jakarta.validation.constraints.NotNull;

import com.ssafy.mozzi.domain.wallet.entity.CareAction;

/**
 * Body of {@code POST /rewards/care}.
 *
 * @param action the care activity the app just finished
 */
public record CareRewardRequestDto(@NotNull(message = "어떤 돌보기를 했는지 알려 주세요.") CareAction action) {
}
