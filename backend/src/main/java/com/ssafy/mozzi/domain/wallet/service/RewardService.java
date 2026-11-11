package com.ssafy.mozzi.domain.wallet.service;

import java.time.Clock;
import java.time.LocalDate;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.mozzi.domain.wallet.dto.CareRewardResponseDto;
import com.ssafy.mozzi.domain.wallet.dto.DailyLoginResponseDto;
import com.ssafy.mozzi.domain.wallet.dto.RewardResponseDto;
import com.ssafy.mozzi.domain.wallet.entity.CareAction;
import com.ssafy.mozzi.domain.wallet.entity.RewardType;

/**
 * Daily ticket rewards. There is no claim API: a reward is paid by the request that meets its
 * condition, and that request's response carries it.
 */
@Service
public class RewardService {

    private final WalletService walletService;
    private final Clock clock;

    public RewardService(WalletService walletService, Clock clock) {
        this.walletService = walletService;
        this.clock = clock;
    }

    /** The day's first app launch. Later calls the same day answer {@code granted: false}. */
    @Transactional
    public DailyLoginResponseDto dailyLogin(Long memberId) {
        LocalDate today = LocalDate.now(clock);
        return DailyLoginResponseDto.of(today, walletService.grant(memberId, RewardType.DAILY_LOGIN, null, today));
    }

    /**
     * A care activity the app finished (petting, feeding, three throws). Each activity pays once a
     * day; later reports the same day answer {@code granted: false} with the balance as it stands.
     * The server cannot see the activity itself, the same trust as {@link #dailyLogin}.
     */
    @Transactional
    public CareRewardResponseDto care(Long memberId, CareAction action) {
        LocalDate today = LocalDate.now(clock);
        return CareRewardResponseDto.of(today, action, walletService.grant(memberId, action.reward(), null, today));
    }

    /**
     * Pays for the diary just written, in the diary's transaction, once per record date.
     *
     * @return {@code null} when the date was already rewarded
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public RewardResponseDto dailyRecord(Long memberId, Long diaryId, LocalDate recordDate) {
        return RewardResponseDto.ofPaid(walletService.grant(memberId, RewardType.DAILY_RECORD, diaryId, recordDate));
    }

}
