package com.ssafy.mozzi.domain.image.service;

/**
 * Sends a picture request to the AI server ({@code ai-request} queue).
 */
public interface ImageRequestPublisher {

    /**
     * @throws RuntimeException when the message could not be handed over
     */
    void publish(Message message);

    /**
     * The request body agreed with the AI server. It cannot read the database, so everything
     * it needs is in here.
     *
     * @param userId    the member the diary belongs to
     * @param date      the diary's day, {@code YYYY-MM-DD}; always today, since pictures can
     *                  only be requested on the day
     * @param emotion   the diary's emotion code, such as {@code CALM}
     * @param timeOfDay English, or {@code null}
     * @param where     English, or {@code null}
     * @param who       English, or {@code null}
     * @param what      English
     */
    record Message(
            Long diaryId,
            Long userId,
            String date,
            String emotion,
            String characterImageUrl,
            String characterPrompt,
            String timeOfDay,
            String where,
            String who,
            String what) {
    }

}
