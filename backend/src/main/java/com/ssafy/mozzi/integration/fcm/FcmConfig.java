package com.ssafy.mozzi.integration.fcm;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

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
            log.warn("FIREBASE_SA_KEY is not set; push notifications are only logged");
            return new LoggingPushSender();
        }
        return new FcmPushSender(FirebaseMessaging.getInstance(firebaseApp(properties.serviceAccountKey())));
    }

    private static FirebaseApp firebaseApp(String serviceAccountKey) throws IOException {
        for (FirebaseApp app : FirebaseApp.getApps()) {
            if (app.getName().equals(APP_NAME)) {
                return app;
            }
        }
        GoogleCredentials credentials =
                GoogleCredentials.fromStream(new ByteArrayInputStream(serviceAccountJson(serviceAccountKey)));
        return FirebaseApp.initializeApp(FirebaseOptions.builder().setCredentials(credentials).build(), APP_NAME);
    }

    /**
     * The key file's JSON, given either as is or Base64-encoded. Secret stores often hold the
     * Base64 form, since a multi-line JSON with quotes is awkward in an environment variable.
     */
    static byte[] serviceAccountJson(String serviceAccountKey) {
        String key = serviceAccountKey.strip();
        return key.startsWith("{")
                ? key.getBytes(StandardCharsets.UTF_8)
                : Base64.getMimeDecoder().decode(key);
    }

}
