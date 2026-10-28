package com.ssafy.mozzi.domain.member.service;

/**
 * Delivers a push to one device token. FCM in production; without a Firebase key it only
 * logs.
 */
public interface PushSender {

    /**
     * @return {@link Outcome#TOKEN_INVALID} when the token will never work again (the app was
     *         uninstalled, say), so the device can be turned off
     * @throws RuntimeException when the push could not be sent this time
     */
    Outcome send(String token, PushMessage message);

    enum Outcome {
        SENT,
        TOKEN_INVALID
    }

}
