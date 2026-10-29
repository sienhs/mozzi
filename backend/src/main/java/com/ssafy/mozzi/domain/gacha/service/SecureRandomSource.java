package com.ssafy.mozzi.domain.gacha.service;

import java.security.SecureRandom;

import org.springframework.stereotype.Component;

/**
 * {@link SecureRandom}, so draw results cannot be predicted from earlier ones. Thread-safe;
 * one instance serves every request.
 */
@Component
public class SecureRandomSource implements RandomSource {

    private final SecureRandom random = new SecureRandom();

    @Override
    public int nextInt(int bound) {
        return random.nextInt(bound);
    }

}
