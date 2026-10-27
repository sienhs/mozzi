package com.ssafy.mozzi.global.exception;

/**
 * Expected failure that maps to a known {@link ErrorCode}.
 *
 * <p>Two messages are deliberately kept apart. {@link #getMessage()} is developer detail
 * that only ever reaches the logs; {@link #userMessage()} is the sentence sent to the
 * client. The two-argument constructor fills the log detail, not the user message, so a
 * careless call leaks internals into the logs rather than into the response.
 */
public class BusinessException extends RuntimeException {

    private final ErrorCode errorCode;
    private final String userMessage;

    public BusinessException(ErrorCode errorCode) {
        this(errorCode, errorCode.code(), errorCode.message());
    }

    /**
     * @param logDetail context for the logs, never sent to the client
     */
    public BusinessException(ErrorCode errorCode, String logDetail) {
        this(errorCode, logDetail, errorCode.message());
    }

    /**
     * @param logDetail   context for the logs, never sent to the client
     * @param userMessage sentence shown to the user instead of {@link ErrorCode#message()},
     *                    for codes that need a more specific wording
     */
    public BusinessException(ErrorCode errorCode, String logDetail, String userMessage) {
        super(logDetail);
        this.errorCode = errorCode;
        this.userMessage = userMessage;
    }

    public BusinessException(ErrorCode errorCode, String logDetail, Throwable cause) {
        super(logDetail, cause);
        this.errorCode = errorCode;
        this.userMessage = errorCode.message();
    }

    public ErrorCode errorCode() {
        return errorCode;
    }

    public String userMessage() {
        return userMessage;
    }

}
