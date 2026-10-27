package com.ssafy.mozzi.integration.google;

/** The submitted token is not a valid Google ID token for this app. */
public class GoogleIdTokenInvalidException extends RuntimeException {

    public GoogleIdTokenInvalidException(String message, Throwable cause) {
        super(message, cause);
    }

}
