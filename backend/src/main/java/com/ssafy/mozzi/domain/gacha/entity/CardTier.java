package com.ssafy.mozzi.domain.gacha.entity;

/**
 * Card tiers, rarest last. The collection lists cards rarest first, so it sorts by this order
 * reversed.
 *
 * <p>{@link #NONE} is the basic mozzi every member gets at sign-up, one per emotion. It is
 * never drawn and stays out of the collection.
 */
public enum CardTier {

    NONE,
    COMMON,
    RARE,
    EPIC,
    LEGENDARY,
    MYTHIC;

    /** Whether cards of this tier are in the draw pool and the collection. */
    public boolean isDrawn() {
        return this != NONE;
    }

    /**
     * Legendary and mythic cards are drawn from the ones the member lacks first, which keeps
     * the rarest pulls from being duplicates without changing the tier odds.
     */
    public boolean prefersUnowned() {
        return this == LEGENDARY || this == MYTHIC;
    }

}
