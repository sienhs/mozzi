package com.ssafy.mozzi.integration.fcm;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.charset.StandardCharsets;
import java.security.KeyPairGenerator;
import java.util.Base64;

import org.junit.jupiter.api.Test;

import com.ssafy.mozzi.domain.member.service.PushSender;

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

    /**
     * With a key the sender is built on the Firebase SDK, which no other test reaches since
     * they run without one. A missing SDK dependency then only showed once prod had a key, as
     * a server that would not start.
     */
    @Test
    void buildsTheFcmSenderWhenAKeyIsSet() throws Exception {
        PushSender sender = new FcmConfig().pushSender(new FcmProperties(serviceAccountKey()));

        assertThat(sender).isInstanceOf(FcmPushSender.class);
    }

    /** A service account key file with a throwaway private key. Nothing is sent with it. */
    private static String serviceAccountKey() throws Exception {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        String privateKey = "-----BEGIN PRIVATE KEY-----\\n"
                + Base64.getEncoder().encodeToString(generator.generateKeyPair().getPrivate().getEncoded())
                + "\\n-----END PRIVATE KEY-----\\n";
        return """
                {"type": "service_account", "project_id": "mozzi-test", "private_key_id": "test",
                 "private_key": "%s", "client_email": "push@mozzi-test.iam.gserviceaccount.com",
                 "client_id": "1", "token_uri": "https://oauth2.googleapis.com/token"}
                """.formatted(privateKey);
    }

    private static String text(byte[] bytes) {
        return new String(bytes, StandardCharsets.UTF_8);
    }

}
