package com.ssafy.mozzi.domain.wallet.entity;

import java.time.LocalDate;

/**
 * Ticket rewards granted the moment their condition is met (gacha.md "뽑기권 지급").
 *
 * <p>Each grant carries a reward key, unique per member, so a reward is paid at most once
 * however many requests race for it.
 */
public enum RewardType {

    SIGNUP(20, LedgerReason.SIGNUP),
    DAILY_LOGIN(5, LedgerReason.DAILY_LOGIN),
    DAILY_RECORD(5, LedgerReason.DAILY_RECORD),
    /** Care: petting, feeding and playing with a mochi, each once a day (gacha.md "돌보기 보상"). */
    CARE_PET(2, LedgerReason.CARE),
    CARE_FEED(2, LedgerReason.CARE),
    CARE_PLAY(2, LedgerReason.CARE);

    private final int tickets;
    private final LedgerReason reason;

    RewardType(int tickets, LedgerReason reason) {
        this.tickets = tickets;
        this.reason = reason;
    }

    public int tickets() {
        return tickets;
    }

    public LedgerReason reason() {
        return reason;
    }

    /**
     * {@code SIGNUP}, {@code LOGIN:2026-10-29}, {@code RECORD:2026-10-29} or {@code CARE_PET:2026-10-29}.
     *
     * @param date the day the reward is for; ignored for {@link #SIGNUP}
     */
    public String rewardKey(LocalDate date) {
        return switch (this) {
            case SIGNUP -> "SIGNUP";
            case DAILY_LOGIN -> "LOGIN:" + date;
            case DAILY_RECORD -> "RECORD:" + date;
            case CARE_PET, CARE_FEED, CARE_PLAY -> name() + ":" + date;
        };
    }

}
