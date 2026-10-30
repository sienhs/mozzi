package com.ssafy.mozzi.domain.gacha.service;

import java.util.Arrays;
import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import com.ssafy.mozzi.domain.gacha.entity.CardTier;
import com.ssafy.mozzi.domain.gacha.entity.GachaTier;
import com.ssafy.mozzi.domain.gacha.repository.GachaTierRepository;

/**
 * The tier rules, read once at start-up and checked there.
 *
 * <p>A missing tier or weights that do not add up would skew every draw without failing any
 * of them, so the application refuses to start instead.
 *
 * <p>Only the drawn tiers are kept. {@link CardTier#NONE} has a row in {@code gacha_tier} only
 * because {@code mozzi_card.tier} references it.
 */
@Component
public class GachaTierCatalog {

    /** Weights add up to this; a draw rolls {@code 0 .. TOTAL_WEIGHT - 1}. */
    public static final int TOTAL_WEIGHT = 100_000;

    private static final int DRAWN_TIERS = (int) Arrays.stream(CardTier.values()).filter(CardTier::isDrawn).count();

    private final Map<CardTier, GachaTier> tiers;

    @Autowired
    public GachaTierCatalog(GachaTierRepository repository) {
        this(repository.findAll());
    }

    GachaTierCatalog(List<GachaTier> rows) {
        Map<CardTier, GachaTier> byTier = new EnumMap<>(CardTier.class);
        rows.stream()
                .filter(row -> row.getTier().isDrawn())
                .forEach(row -> byTier.put(row.getTier(), row));
        if (byTier.size() != DRAWN_TIERS) {
            throw new IllegalStateException("gacha_tier must have a row for every tier, found " + byTier.keySet());
        }
        int total = byTier.values().stream().mapToInt(GachaTier::getWeight).sum();
        if (total != TOTAL_WEIGHT) {
            throw new IllegalStateException("gacha_tier weights must add up to " + TOTAL_WEIGHT + ", found " + total);
        }
        this.tiers = Collections.unmodifiableMap(byTier);
    }

    /**
     * The tier a roll lands in, walking the tiers commonest first.
     *
     * @param roll {@code 0 .. TOTAL_WEIGHT - 1}
     */
    public CardTier tierFor(int roll) {
        int upper = 0;
        for (GachaTier tier : tiers.values()) {
            upper += tier.getWeight();
            if (roll < upper) {
                return tier.getTier();
            }
        }
        throw new IllegalArgumentException("roll out of range: " + roll);
    }

    /** A drawn tier's rules; {@code null} for {@link CardTier#NONE}. */
    public GachaTier get(CardTier tier) {
        return tiers.get(tier);
    }

    /** Commonest first. */
    public List<GachaTier> all() {
        return List.copyOf(tiers.values());
    }

}
