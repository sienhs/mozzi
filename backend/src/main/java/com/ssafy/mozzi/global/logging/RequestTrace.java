package com.ssafy.mozzi.global.logging;

import org.slf4j.MDC;

/**
 * MDC keys and accessors for the per-request diagnostic context.
 *
 * <p>Values put here are picked up by structured logging
 * ({@code logging.structured.json.context.include}) and by the error body's
 * {@code traceId}, so a user-reported error can be found in the logs by one search.
 *
 * <p>{@link #TRACE_ID} is currently produced by {@link TraceIdFilter}. When Micrometer
 * Tracing is introduced, this is the single place to switch to its trace id — the format
 * is already W3C-compatible (32 lowercase hex characters) so stored ids stay comparable.
 */
public final class RequestTrace {

    /** 32 lowercase hex characters, matching the W3C trace-context trace-id format. */
    public static final String TRACE_ID = "traceId";

    /** Set once the request is authenticated. Absent for anonymous endpoints. */
    public static final String MEMBER_ID = "memberId";

    /** Response header carrying {@link #TRACE_ID} so clients can quote it in a report. */
    public static final String TRACE_ID_HEADER = "X-Trace-Id";

    private RequestTrace() {
    }

    /**
     * @return the current request's trace id, or {@code null} outside a request (for example
     *         in a background worker that has not inherited the context)
     */
    public static String traceId() {
        return MDC.get(TRACE_ID);
    }

    public static void putMemberId(Long memberId) {
        if (memberId != null) {
            MDC.put(MEMBER_ID, String.valueOf(memberId));
        }
    }

}
