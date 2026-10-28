package com.ssafy.mozzi.integration.fcm;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Firebase settings under {@code mozzi.fcm}.
 *
 * @param serviceAccountKey the service account key file's content (from
 *                          {@code FIREBASE_SA_KEY}): the JSON as is, or Base64-encoded. Not a
 *                          path. Blank outside prod: pushes are then only logged. It is a
 *                          credential that can push to every user, so it comes from the
 *                          environment and is never committed or logged
 */
@ConfigurationProperties("mozzi.fcm")
public record FcmProperties(String serviceAccountKey) {

    public boolean configured() {
        return serviceAccountKey != null && !serviceAccountKey.isBlank();
    }

}
