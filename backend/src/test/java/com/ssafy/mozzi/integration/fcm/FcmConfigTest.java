package com.ssafy.mozzi.integration.fcm;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import org.junit.jupiter.api.Test;

/** {@code FIREBASE_SA_KEY} may hold the key file's JSON as is or Base64-encoded. */
class FcmConfigTest {

    private static final String JSON = "{\"type\": \"service_account\", \"project_id\": \"mozzi\"}";

    @Test
    void readsTheJsonAsIs() {
        assertThat(text(FcmConfig.serviceAccountJson("  " + JSON + "\n"))).isEqualTo(JSON);
    }

    @Test
    void decodesBase64() {
        String encoded = Base64.getEncoder().encodeToString(JSON.getBytes(StandardCharsets.UTF_8));

        assertThat(text(FcmConfig.serviceAccountJson(encoded))).isEqualTo(JSON);
    }

    /** {@code base64} without {@code -w0} wraps at 76 characters. */
    @Test
    void decodesWrappedBase64() {
        String wrapped = Base64.getMimeEncoder().encodeToString(JSON.repeat(3).getBytes(StandardCharsets.UTF_8));

        assertThat(text(FcmConfig.serviceAccountJson(wrapped))).isEqualTo(JSON.repeat(3));
    }

    private static String text(byte[] bytes) {
        return new String(bytes, StandardCharsets.UTF_8);
    }

}
