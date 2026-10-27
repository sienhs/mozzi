package com.ssafy.mozzi.integration.google;

/**
 * What a verified Google ID token says about the user.
 *
 * @param subject Google's {@code sub}: stable for the life of the Google account, and the
 *                only value accounts are identified by
 * @param email   the account's email, or {@code null} when Google did not mark it verified.
 *                Never used to find or merge accounts — an email address can move between
 *                Google accounts
 */
public record GoogleIdentity(String subject, String email) {
}
