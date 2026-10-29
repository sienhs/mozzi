package com.ssafy.mozzi.domain.gacha.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Rules of one tier (ERD {@code gacha_tier}), seeded by V11. Read once at start-up by
 * {@code GachaTierCatalog}; nothing writes them.
 */
@Entity
@Table(name = "gacha_tier")
public class GachaTier {

    @Id
    @Enumerated(EnumType.STRING)
    @Column(length = 10)
    private CardTier tier;

    /** Draw weight out of {@code GachaTierCatalog.TOTAL_WEIGHT}. */
    @Column(nullable = false)
    private int weight;

    /** Star shards for drawing a card the member already has. */
    @Column(name = "duplicate_shards", nullable = false)
    private int duplicateShards;

    /** Star shards an exchange costs, or {@code null} when the tier cannot be exchanged. */
    @Column(name = "exchange_cost")
    private Integer exchangeCost;

    protected GachaTier() {
        // JPA
    }

    /** Rows come from the migration; this is for tests that build a catalog by hand. */
    public GachaTier(CardTier tier, int weight, int duplicateShards, Integer exchangeCost) {
        this.tier = tier;
        this.weight = weight;
        this.duplicateShards = duplicateShards;
        this.exchangeCost = exchangeCost;
    }

    public CardTier getTier() {
        return tier;
    }

    public int getWeight() {
        return weight;
    }

    public int getDuplicateShards() {
        return duplicateShards;
    }

    public Integer getExchangeCost() {
        return exchangeCost;
    }

}
