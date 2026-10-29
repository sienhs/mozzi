package com.ssafy.mozzi.domain.gacha.service;

/**
 * Where draws get their randomness. Production uses {@link SecureRandomSource}; tests replace
 * it with fixed values to land on a chosen tier and card.
 */
public interface RandomSource {

    /** @return {@code 0 .. bound - 1}, uniformly */
    int nextInt(int bound);

}
