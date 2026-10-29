package com.ssafy.mozzi.domain.gacha.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Random;

import org.junit.jupiter.api.Test;

import com.ssafy.mozzi.domain.gacha.entity.CardTier;
import com.ssafy.mozzi.domain.gacha.entity.GachaTier;

class GachaTierCatalogTest {

    /** Chi-square distribution, 4 degrees of freedom, upper 1%: from the standard table. */
    private static final double CHI_SQUARE_CRITICAL_DF4_ALPHA_1PCT = 13.277;

    private static final List<GachaTier> SEEDED = List.of(
            new GachaTier(CardTier.COMMON, 45_000, 1, null),
            new GachaTier(CardTier.RARE, 30_000, 2, null),
            new GachaTier(CardTier.EPIC, 17_000, 5, null),
            new GachaTier(CardTier.LEGENDARY, 7_000, 15, 200),
            new GachaTier(CardTier.MYTHIC, 1_000, 40, 400));

    private final GachaTierCatalog catalog = new GachaTierCatalog(SEEDED);

    /**
     * 100,000 rolls from a fixed seed land within 0.3 percentage points of every tier's rate.
     *
     * <p>For EPIC that margin is about 2.5 standard deviations, so some seeds fall outside it
     * by chance alone; the seed is fixed to keep the check deterministic, not tuned to the code.
     */
    @Test
    void rollsFollowTheWeights() {
        Random random = new Random(42L);
        int rolls = 100_000;
        Map<CardTier, Integer> counts = new EnumMap<>(CardTier.class);
        for (int i = 0; i < rolls; i++) {
            counts.merge(catalog.tierFor(random.nextInt(GachaTierCatalog.TOTAL_WEIGHT)), 1, Integer::sum);
        }

        for (GachaTier tier : SEEDED) {
            double expected = (double) tier.getWeight() / GachaTierCatalog.TOTAL_WEIGHT;
            double actual = (double) counts.getOrDefault(tier.getTier(), 0) / rolls;
            assertThat(actual).as(tier.getTier().name()).isCloseTo(expected, within(0.003));
        }
    }

    /**
     * Chi-square goodness of fit: do the rolls follow the published rates as a whole?
     *
     * <p>The per-tier check above looks at each tier alone, with a margin picked by hand.
     * This one weighs all five tiers in one statistic, {@code Σ (observed − expected)² /
     * expected}, and compares it with the critical value of the chi-square distribution with
     * 4 degrees of freedom (five tiers minus one). Below it, the rolls are consistent with the
     * published rates at a 1% significance level.
     */
    @Test
    void rollsPassAChiSquareTestAgainstThePublishedRates() {
        Map<CardTier, Integer> counts = roll(catalog, new Random(42L), 100_000);

        assertThat(chiSquare(counts, SEEDED, 100_000)).isLessThan(CHI_SQUARE_CRITICAL_DF4_ALPHA_1PCT);
    }

    /**
     * The same test catches odds that drifted from what is published: rolls from the first
     * draft's weights (legendary 6.5%, mythic 1.5%) are refused against the published 7% and 1%.
     */
    @Test
    void theChiSquareTestRefusesOddsThatDriftedFromThePublishedOnes() {
        GachaTierCatalog drifted = new GachaTierCatalog(List.of(
                new GachaTier(CardTier.COMMON, 45_000, 1, null),
                new GachaTier(CardTier.RARE, 30_000, 2, null),
                new GachaTier(CardTier.EPIC, 17_000, 5, null),
                new GachaTier(CardTier.LEGENDARY, 6_500, 15, 200),
                new GachaTier(CardTier.MYTHIC, 1_500, 40, 400)));
        Map<CardTier, Integer> counts = roll(drifted, new Random(42L), 100_000);

        assertThat(chiSquare(counts, SEEDED, 100_000)).isGreaterThan(CHI_SQUARE_CRITICAL_DF4_ALPHA_1PCT);
    }

    @Test
    void boundariesBelongToTheNextTier() {
        assertThat(catalog.tierFor(0)).isEqualTo(CardTier.COMMON);
        assertThat(catalog.tierFor(44_999)).isEqualTo(CardTier.COMMON);
        assertThat(catalog.tierFor(45_000)).isEqualTo(CardTier.RARE);
        assertThat(catalog.tierFor(91_999)).isEqualTo(CardTier.EPIC);
        assertThat(catalog.tierFor(92_000)).isEqualTo(CardTier.LEGENDARY);
        assertThat(catalog.tierFor(98_999)).isEqualTo(CardTier.LEGENDARY);
        assertThat(catalog.tierFor(99_000)).isEqualTo(CardTier.MYTHIC);
        assertThat(catalog.tierFor(99_999)).isEqualTo(CardTier.MYTHIC);
    }

    @Test
    void aMissingTierStopsStartUp() {
        assertThatThrownBy(() -> new GachaTierCatalog(SEEDED.subList(0, 4)))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("every tier");
    }

    @Test
    void weightsThatDoNotAddUpStopStartUp() {
        List<GachaTier> skewed = List.of(
                new GachaTier(CardTier.COMMON, 45_000, 1, null),
                new GachaTier(CardTier.RARE, 30_000, 2, null),
                new GachaTier(CardTier.EPIC, 17_000, 5, null),
                new GachaTier(CardTier.LEGENDARY, 6_500, 15, 200),
                new GachaTier(CardTier.MYTHIC, 1_000, 40, 400));

        assertThatThrownBy(() -> new GachaTierCatalog(skewed))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("99500");
    }

    private static Map<CardTier, Integer> roll(GachaTierCatalog catalog, Random random, int rolls) {
        Map<CardTier, Integer> counts = new EnumMap<>(CardTier.class);
        for (int i = 0; i < rolls; i++) {
            counts.merge(catalog.tierFor(random.nextInt(GachaTierCatalog.TOTAL_WEIGHT)), 1, Integer::sum);
        }
        return counts;
    }

    /** {@code Σ (observed − expected)² / expected} over the tiers, expected from the published weights. */
    private static double chiSquare(Map<CardTier, Integer> counts, List<GachaTier> published, int rolls) {
        double statistic = 0;
        for (GachaTier tier : published) {
            double expected = (double) rolls * tier.getWeight() / GachaTierCatalog.TOTAL_WEIGHT;
            double observed = counts.getOrDefault(tier.getTier(), 0);
            statistic += (observed - expected) * (observed - expected) / expected;
        }
        return statistic;
    }

}
