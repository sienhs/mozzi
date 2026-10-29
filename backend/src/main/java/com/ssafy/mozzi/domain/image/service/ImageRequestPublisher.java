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
     * @param date      the diary's day, {@code YYYY-MM-DD}; today, since pictures can only
     *                  be requested on the day, except through the test API
     * @param emotion   the diary's emotion code, such as {@code CALM}
     * @param characterImageUrl {@code "DEFAULT"} until the character image is set up
     * @param timeOfDay English, or {@code ""}
     * @param weather   English, or {@code ""} for {@code NONE}
     * @param where     English, or {@code ""}
     * @param who       English, or {@code ""}
     * @param what      English
     * @param test      from the temporary test API; the AI server then uploads to
     *                  {@code test/diary/{userId}/{diaryId}/} instead of {@code diary/...}
     */
    record Message(
            Long diaryId,
            Long userId,
            String date,
            String emotion,
            String characterImageUrl,
            String characterPrompt,
            String timeOfDay,
            String weather,
            String where,
            String who,
            String what,
            boolean test) {
    }

}
