package com.ssafy.mozzi.domain.gacha.entity;

/**
 * Card tiers, rarest last. The collection lists cards rarest first, so it sorts by this order
 * reversed.
 */
public enum CardTier {

    COMMON,
    RARE,
    EPIC,
    LEGENDARY,
    MYTHIC;

    /**
     * Legendary and mythic cards are drawn from the ones the member lacks first, which keeps
     * the rarest pulls from being duplicates without changing the tier odds.
     */
    public boolean prefersUnowned() {
        return this == LEGENDARY || this == MYTHIC;
    }

}
