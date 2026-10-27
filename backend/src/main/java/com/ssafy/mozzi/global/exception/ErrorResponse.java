package com.ssafy.mozzi.global.exception;

import java.util.List;

/**
 * Error body defined by API spec 1.2.
 *
 * <p>The shape is a contract shared by every endpoint, so adding a field changes the whole
 * API at once. {@code ErrorResponseContractTest} pins it.
 *
 * <p>{@code fieldErrors} stays present as {@code null} for non-validation failures instead
 * of being dropped, matching the spec's rule that keys the client branches on are always
 * there (spec 1.1, for example {@code "todayDiary": null}).
 *
 * @param code      stable identifier, see {@link ErrorCode#code()}
 * @param message   sentence shown to the user as-is
 * @param fieldErrors per-field reasons for validation failures, otherwise {@code null}
 * @param traceId   id to search the server logs with, see
 *                  {@link com.ssafy.mozzi.global.logging.RequestTrace}
 */
public record ErrorResponse(String code, String message, List<FieldError> fieldErrors, String traceId) {

    /**
     * @param field  request field path, as the client sent it
     * @param reason sentence shown to the user next to that field
     */
    public record FieldError(String field, String reason) {
    }

    public static ErrorResponse of(ErrorCode errorCode, String traceId) {
        return new ErrorResponse(errorCode.code(), errorCode.message(), null, traceId);
    }

    public static ErrorResponse of(ErrorCode errorCode, String message, String traceId) {
        return new ErrorResponse(errorCode.code(), message, null, traceId);
    }

    public static ErrorResponse of(ErrorCode errorCode, List<FieldError> fieldErrors, String traceId) {
        return new ErrorResponse(errorCode.code(), errorCode.message(), fieldErrors, traceId);
    }

}
