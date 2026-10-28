package com.ssafy.mozzi.domain.image.service;

import com.ssafy.mozzi.domain.image.exception.InappropriatePromptException;

/**
 * Turns the tags the member picked (Korean) into English phrases for the image prompt.
 *
 * <p>All three go in one call: one round trip per picture, and the model sees them together,
 * so "치맥" and "한강 공원" are read in the same context.
 */
public interface PromptTranslator {

    /**
     * @throws InappropriatePromptException when the inputs are not fit to draw; the request
     *                                      then fails and counts as the member's failure
     * @throws RuntimeException             when no translation can be had; the request is then
     *                                      given up without counting as the member's failure
     */
    Translation translate(Source source);

    /**
     * @param where optional
     * @param who   optional
     * @param what  required
     */
    record Source(String where, String who, String what) {
    }

    /**
     * @param where a place phrase such as "at home", or {@code null}
     * @param who   a companion phrase such as "with mom", or {@code null}
     * @param what  an activity phrase such as "cooking dinner"
     */
    record Translation(String where, String who, String what) {
    }

}
