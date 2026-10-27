package com.ssafy.mozzi.domain.image.service;

import java.util.Optional;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

/**
 * Stand-in until the S3 integration exists.
 *
 * <p>No attempt can reach {@code SUCCEEDED} before the worker does, so in practice this is
 * never asked for a key. If it is, the response carries {@code imageUrl: null}, which the
 * app already handles as "no picture yet", and the warning says why. Replace it with the S3
 * signer in {@code integration} rather than adding a second bean.
 */
@Component
public class UnconfiguredImageUrlSigner implements ImageUrlSigner {

    private static final Logger log = LoggerFactory.getLogger(UnconfiguredImageUrlSigner.class);

    @Override
    public Optional<SignedUrl> sign(String imageKey) {
        log.warn("image URL requested but no signer is configured yet");
        return Optional.empty();
    }

}
