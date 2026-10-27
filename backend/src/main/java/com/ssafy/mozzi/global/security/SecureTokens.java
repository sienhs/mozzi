package com.ssafy.mozzi.global.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;
import java.util.HexFormat;

/**
 * Random opaque tokens (refresh tokens, sign-up tickets) and the hashes stored for them.
 *
 * <p>Plain SHA-256 is the right hash here, not a slow password hash: the input is 256 bits of
 * CSPRNG output, so there is nothing to brute-force, and the same input always produces the
 * same hash, which is what lets the server look a submitted token up without storing it.
 */
public final class SecureTokens {

    private static final int TOKEN_BYTES = 32;

    /** Thread-safe; one instance avoids reseeding on every call. */
    private static final SecureRandom RANDOM = new SecureRandom();

    private static final Base64.Encoder BASE64_URL = Base64.getUrlEncoder().withoutPadding();

    private SecureTokens() {
    }

    /** 32 random bytes as unpadded Base64url (43 characters). */
    public static String randomToken() {
        byte[] bytes = new byte[TOKEN_BYTES];
        RANDOM.nextBytes(bytes);
        return BASE64_URL.encodeToString(bytes);
    }

    /** Lowercase hex SHA-256 (64 characters), the form the database stores. */
    public static String sha256Hex(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            // Every Java platform is required to provide SHA-256.
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    /** Compares two hashes in constant time, so the comparison does not leak how much matched. */
    public static boolean hashesMatch(String expected, String actual) {
        return MessageDigest.isEqual(
                expected.getBytes(StandardCharsets.US_ASCII), actual.getBytes(StandardCharsets.US_ASCII));
    }

}
