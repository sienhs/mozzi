package com.ssafy.mozzi.global.exception;

import org.springframework.http.HttpStatus;

/**
 * Contract that every error code enum implements.
 *
 * <p>Each domain declares its own enum (for example {@code DiaryErrorCode}) rather than
 * adding to one project-wide enum. A single enum would be touched by every feature branch
 * and conflict on every merge.
 *
 * @see CommonErrorCode
 */
public interface ErrorCode {

    /** HTTP status this code is returned with. */
    HttpStatus status();

    /** Stable identifier the client branches on. Never reworded, never translated. */
    String code();

    /**
     * Sentence shown to the user as-is (API spec 1.2).
     *
     * <p>Developer detail must not go here — it would be sent to the client. Put it in the
     * log detail of {@link BusinessException} instead.
     */
    String message();

}
