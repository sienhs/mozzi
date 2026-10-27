package com.ssafy.mozzi.global.exception;

import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

/**
 * Builds the {@link ResponseEntity} every {@code @ExceptionHandler} returns.
 *
 * <p>The Content-Type is fixed to JSON so Spring skips negotiating it against the request's
 * {@code Accept}. Negotiated, a client asking for XML left no converter able to write the
 * error, so the handler itself failed and the client got an empty 500 instead of the spec
 * 1.2 body. {@link ErrorResponseWriter} does the same for the filter chain.
 */
public final class ErrorResponseEntity {

    private ErrorResponseEntity() {
    }

    public static <T> ResponseEntity<T> of(HttpStatusCode status, T body) {
        return ResponseEntity.status(status).contentType(MediaType.APPLICATION_JSON).body(body);
    }

    public static ResponseEntity<ErrorResponse> of(ErrorCode errorCode, String traceId) {
        return of(errorCode.status(), ErrorResponse.of(errorCode, traceId));
    }

}
