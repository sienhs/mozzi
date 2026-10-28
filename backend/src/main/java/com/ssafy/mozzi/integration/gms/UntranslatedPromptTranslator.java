package com.ssafy.mozzi.integration.gms;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.ssafy.mozzi.domain.image.service.PromptTranslator;

/**
 * Passes the Korean through unchanged, for a local server or tests without a real GMS key
 * ({@code mozzi.image.translate: false}). prod translates.
 */
class UntranslatedPromptTranslator implements PromptTranslator {

    private static final Logger log = LoggerFactory.getLogger(UntranslatedPromptTranslator.class);

    @Override
    public Translation translate(Source source) {
        log.warn("image translation is off; picture inputs are sent untranslated");
        return new Translation(source.where(), source.who(), source.what(), source.character());
    }

}
