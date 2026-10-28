package com.ssafy.mozzi.integration.fcm;

import java.util.Set;

import com.google.firebase.messaging.AndroidConfig;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.Message;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.Notification;
import com.ssafy.mozzi.domain.member.service.PushMessage;
import com.ssafy.mozzi.domain.member.service.PushSender;

/**
 * Sends one push through the FCM HTTP v1 API.
 *
 * <p>The message carries both a notification, which the OS shows while the app is in the
 * background, and data, which the app reads to open the right screen. In the foreground the
 * OS shows nothing and the app decides.
 */
class FcmPushSender implements PushSender {

    /**
     * Errors that mean the token itself is dead. {@code INVALID_ARGUMENT} is left out on
     * purpose: it also covers a malformed message, and treating that as a dead token would
     * turn off every device at once.
     */
    private static final Set<MessagingErrorCode> DEAD_TOKEN =
            Set.of(MessagingErrorCode.UNREGISTERED, MessagingErrorCode.SENDER_ID_MISMATCH);

    private final FirebaseMessaging messaging;

    FcmPushSender(FirebaseMessaging messaging) {
        this.messaging = messaging;
    }

    @Override
    public Outcome send(String token, PushMessage message) {
        try {
            messaging.send(Message.builder()
                    .setToken(token)
                    .setNotification(Notification.builder()
                            .setTitle(message.title())
                            .setBody(message.body())
                            .build())
                    .putAllData(message.data())
                    // Delivered at once rather than batched by Doze, since the member is
                    // waiting for the picture.
                    .setAndroidConfig(AndroidConfig.builder().setPriority(AndroidConfig.Priority.HIGH).build())
                    .build());
            return Outcome.SENT;
        } catch (FirebaseMessagingException e) {
            if (DEAD_TOKEN.contains(e.getMessagingErrorCode())) {
                return Outcome.TOKEN_INVALID;
            }
            throw new IllegalStateException("FCM send failed: " + e.getMessagingErrorCode(), e);
        }
    }

}
