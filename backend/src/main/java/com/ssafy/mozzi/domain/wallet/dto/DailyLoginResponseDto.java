package com.ssafy.mozzi.domain.wallet.dto;

import java.time.LocalDate;

import com.ssafy.mozzi.domain.wallet.service.WalletService.RewardGrant;

/**
 * {@code POST /rewards/daily-login}.
 *
 * @param date        today in the service timezone, the day the reward is for
 * @param granted     {@code false} from the day's second call on
 * @param tickets     tickets just paid, {@code 0} when not granted
 * @param ticketCount the balance after this call
 */
public record DailyLoginResponseDto(LocalDate date, boolean granted, int tickets, int ticketCount) {

    public static DailyLoginResponseDto of(LocalDate date, RewardGrant grant) {
        return new DailyLoginResponseDto(date, grant.granted(), grant.tickets(), grant.ticketCount());
    }

}
