package com.ssafy.mozzi.domain.wallet.dto;

import java.time.LocalDate;

import com.ssafy.mozzi.domain.wallet.entity.CareAction;
import com.ssafy.mozzi.domain.wallet.entity.RewardType;
import com.ssafy.mozzi.domain.wallet.service.WalletService.RewardGrant;

/**
 * {@code POST /rewards/care}.
 *
 * @param date        today in the service timezone, the day the reward is for
 * @param action      the care activity that was reported
 * @param type        its reward type ({@code CARE_PET}, {@code CARE_FEED} or {@code CARE_PLAY})
 * @param granted     {@code false} when this activity was already rewarded today
 * @param tickets     tickets just paid, {@code 0} when not granted
 * @param ticketCount the balance after this call
 */
public record CareRewardResponseDto(
        LocalDate date, CareAction action, RewardType type, boolean granted, int tickets, int ticketCount) {

    public static CareRewardResponseDto of(LocalDate date, CareAction action, RewardGrant grant) {
        return new CareRewardResponseDto(date, action, grant.type(), grant.granted(), grant.tickets(), grant.ticketCount());
    }

}
