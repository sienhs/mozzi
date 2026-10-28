package com.ssafy.mozzi.domain.image.service;

/**
 * Turns what the member picked (Korean) into English phrases for the image prompt.
 *
 * <p>All four parts go in one call: one round trip per picture, and the model sees them
 * together, so "치맥" and "한강 공원" are read in the same context.
 */
public interface PromptTranslator {

    /**
     * @throws RuntimeException when no translation can be had; the request is then given up
     *                          without counting as the member's failure
     */
    Translation translate(Source source);

    /**
     * @param where     optional
     * @param who       optional
     * @param what      required
     * @param character the character's description
     */
    record Source(String where, String who, String what, String character) {
    }

    /**
     * @param where     a place phrase such as "at home", or {@code null}
     * @param who       a companion phrase such as "with mom", or {@code null}
     * @param what      an activity phrase such as "cooking dinner"
     * @param character a short visual description
     */
    record Translation(String where, String who, String what, String character) {
    }

}
