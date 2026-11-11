package com.ssafy.mozzi.domain.wallet.entity;

/**
 * A care activity the app finished with a mochi. Each pays its {@link RewardType} once a day.
 */
public enum CareAction {
    PET(RewardType.CARE_PET),
    FEED(RewardType.CARE_FEED),
    PLAY(RewardType.CARE_PLAY);

    private final RewardType reward;

    CareAction(RewardType reward) {
        this.reward = reward;
    }

    public RewardType reward() {
        return reward;
    }

}
