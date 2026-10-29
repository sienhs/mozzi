package com.ssafy.mozzi.domain.wallet.dto;

import com.ssafy.mozzi.domain.wallet.entity.RewardType;
import com.ssafy.mozzi.domain.wallet.service.WalletService.RewardGrant;

/**
 * A reward paid by the request it is returned from, such as {@code reward} in
 * {@code POST /diaries}. The app shows its alert from this.
 *
 * @param tickets     tickets just paid
 * @param ticketCount the balance after paying them
 */
public record RewardResponseDto(RewardType type, int tickets, int ticketCount) {

    /** @return {@code null} when nothing was paid, as the spec sends it */
    public static RewardResponseDto ofPaid(RewardGrant grant) {
        return grant.granted() ? new RewardResponseDto(grant.type(), grant.tickets(), grant.ticketCount()) : null;
    }

}
