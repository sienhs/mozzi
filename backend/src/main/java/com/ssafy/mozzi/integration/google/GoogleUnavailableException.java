package com.ssafy.mozzi.integration.google;

/**
 * Google's signing keys could not be fetched, so no token can be verified right now.
 *
 * <p>Kept apart from {@link GoogleIdTokenInvalidException} because the app reacts
 * differently: an invalid token means "sign in with Google again", this means "try later".
 */
public class GoogleUnavailableException extends RuntimeException {

    public GoogleUnavailableException(Throwable cause) {
        super("Google signing keys unavailable", cause);
    }

}
