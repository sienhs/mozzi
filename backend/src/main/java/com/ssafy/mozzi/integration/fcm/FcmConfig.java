package com.ssafy.mozzi.integration.fcm;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.FirebaseMessaging;
import com.ssafy.mozzi.domain.member.service.PushSender;

/**
 * The push sender: FCM when a service account key is set, otherwise one that only logs, so a
 * local server or a test starts without a key.
 */
@Configuration
public class FcmConfig {

    /** A named app rather than the default one, so a second context in tests cannot clash. */
    private static final String APP_NAME = "mozzi";

    private static final Logger log = LoggerFactory.getLogger(FcmConfig.class);

    @Bean
    PushSender pushSender(FcmProperties properties) throws IOException {
        if (!properties.configured()) {
            log.warn("FIREBASE_SERVICE_ACCOUNT_JSON is not set; push notifications are only logged");
            return new LoggingPushSender();
        }
        return new FcmPushSender(FirebaseMessaging.getInstance(firebaseApp(properties.serviceAccountJson())));
    }

    private static FirebaseApp firebaseApp(String serviceAccountJson) throws IOException {
        for (FirebaseApp app : FirebaseApp.getApps()) {
            if (app.getName().equals(APP_NAME)) {
                return app;
            }
        }
        GoogleCredentials credentials = GoogleCredentials.fromStream(
                new ByteArrayInputStream(serviceAccountJson.getBytes(StandardCharsets.UTF_8)));
        return FirebaseApp.initializeApp(FirebaseOptions.builder().setCredentials(credentials).build(), APP_NAME);
    }

}
