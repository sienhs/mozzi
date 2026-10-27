package com.ssafy.mozzi.global.util;

/**
 * Hides personal data before it is written anywhere it will be kept.
 *
 * <p>Two different needs share one implementation on purpose, so the rule cannot drift:
 * log lines that must not store an address or a token, and the {@code maskedEmail} field
 * the sign-up screen shows (API spec 4.1).
 */
public final class Masker {

    private static final String MASK = "***";
    private static final int EMAIL_VISIBLE_CHARS = 2;
    private static final int SECRET_VISIBLE_CHARS = 4;

    private Masker() {
    }

    /**
     * Keeps the first two characters of the local part and the whole domain:
     * {@code haru@gmail.com} becomes {@code ha***@gmail.com}, as in spec 4.1.
     *
     * <p>A local part of two characters or fewer is hidden completely rather than shown in
     * full, because {@code ab@x.com} would otherwise be returned unchanged.
     */
    public static String email(String email) {
        if (email == null || email.isBlank()) {
            return null;
        }
        int at = email.indexOf('@');
        if (at < 0) {
            return MASK;
        }
        String localPart = email.substring(0, at);
        String domain = email.substring(at);
        if (localPart.length() <= EMAIL_VISIBLE_CHARS) {
            return MASK + domain;
        }
        return localPart.substring(0, EMAIL_VISIBLE_CHARS) + MASK + domain;
    }

    /**
     * Keeps the first four characters of a token so two log lines can be told apart, and
     * hides the rest. Use for Google id tokens, access and refresh tokens, and FCM tokens.
     */
    public static String secret(String secret) {
        if (secret == null || secret.isBlank()) {
            return null;
        }
        if (secret.length() <= SECRET_VISIBLE_CHARS) {
            return MASK;
        }
        return secret.substring(0, SECRET_VISIBLE_CHARS) + MASK;
    }

}
