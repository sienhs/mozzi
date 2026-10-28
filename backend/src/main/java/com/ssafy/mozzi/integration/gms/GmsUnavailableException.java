package com.ssafy.mozzi.integration.gms;

/**
 * GMS gave no usable answer: a timeout, an error status, a refusal or a malformed body.
 *
 * <p>One type for all of them because the caller reacts the same way to each — emotion
 * search answers {@code SEARCH_UNAVAILABLE}, the embedding job retries later.
 *
 * <p>The message never carries a response body. Bodies can echo the request, and requests
 * carry diary text (convention 5.4).
 */
public class GmsUnavailableException extends RuntimeException {

    public GmsUnavailableException(String message) {
        super(message);
    }

    public GmsUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }

}
