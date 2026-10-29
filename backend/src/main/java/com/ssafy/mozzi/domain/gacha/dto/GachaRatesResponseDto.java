package com.ssafy.mozzi.domain.gacha.dto;

import java.util.List;

import com.ssafy.mozzi.domain.gacha.entity.CardTier;
import com.ssafy.mozzi.domain.gacha.entity.GachaTier;
import com.ssafy.mozzi.domain.gacha.service.GachaTierCatalog;

/** {@code GET /gacha/rates}, commonest tier first. */
public record GachaRatesResponseDto(List<Rate> rates) {

    /** @param rate share of draws, {@code weight / 100000} */
    public record Rate(CardTier tier, double rate, int duplicateShards) {

        public static Rate from(GachaTier tier) {
            return new Rate(tier.getTier(), (double) tier.getWeight() / GachaTierCatalog.TOTAL_WEIGHT,
                    tier.getDuplicateShards());
        }

    }

}
