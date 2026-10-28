package com.ssafy.mozzi.integration.fcm;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Firebase settings under {@code mozzi.fcm}.
 *
 * @param serviceAccountJson the service account key file's content (JSON), not a path. Blank
 *                           outside prod: pushes are then only logged. It is a credential
 *                           that can push to every user, so it comes from the environment
 *                           and is never committed or logged
 */
@ConfigurationProperties("mozzi.fcm")
public record FcmProperties(String serviceAccountJson) {

    public boolean configured() {
        return serviceAccountJson != null && !serviceAccountJson.isBlank();
    }

}
