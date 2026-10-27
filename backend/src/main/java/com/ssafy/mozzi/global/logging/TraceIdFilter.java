package com.ssafy.mozzi.global.logging;

import java.io.IOException;
import java.util.concurrent.ThreadLocalRandom;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Puts a trace id on every request, in the MDC and on the response.
 *
 * <p>This runs first so that anything later — including a filter that rejects the request —
 * can log and answer with the same id.
 *
 * <p>An inbound {@code traceparent} or {@code X-Trace-Id} is reused so a client-side id can
 * be correlated, but only after validation: the value ends up in log lines, and a header
 * containing a newline could otherwise forge a log entry.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class TraceIdFilter extends OncePerRequestFilter {

    private static final String TRACEPARENT_HEADER = "traceparent";
    private static final int TRACE_ID_LENGTH = 32;
    private static final String ALL_ZERO_TRACE_ID = "00000000000000000000000000000000";

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String traceId = resolveTraceId(request);
        MDC.put(RequestTrace.TRACE_ID, traceId);
        response.setHeader(RequestTrace.TRACE_ID_HEADER, traceId);
        try {
            chain.doFilter(request, response);
        } finally {
            // Servlet threads are pooled; leaving the id behind would stamp it on the next
            // unrelated request handled by this thread.
            MDC.remove(RequestTrace.TRACE_ID);
            MDC.remove(RequestTrace.MEMBER_ID);
        }
    }

    private static String resolveTraceId(HttpServletRequest request) {
        String fromTraceparent = parseTraceparent(request.getHeader(TRACEPARENT_HEADER));
        if (fromTraceparent != null) {
            return fromTraceparent;
        }
        String direct = request.getHeader(RequestTrace.TRACE_ID_HEADER);
        if (isValidTraceId(direct)) {
            return direct;
        }
        return newTraceId();
    }

    /** Reads the trace-id field out of a W3C {@code traceparent}: {@code 00-<32 hex>-<16 hex>-01}. */
    private static String parseTraceparent(String traceparent) {
        if (traceparent == null) {
            return null;
        }
        String[] parts = traceparent.split("-");
        if (parts.length < 2 || !isValidTraceId(parts[1])) {
            return null;
        }
        return parts[1];
    }

    private static boolean isValidTraceId(String candidate) {
        if (candidate == null || candidate.length() != TRACE_ID_LENGTH || candidate.equals(ALL_ZERO_TRACE_ID)) {
            return false;
        }
        for (int i = 0; i < TRACE_ID_LENGTH; i++) {
            char c = candidate.charAt(i);
            boolean hex = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f');
            if (!hex) {
                return false;
            }
        }
        return true;
    }

    private static String newTraceId() {
        ThreadLocalRandom random = ThreadLocalRandom.current();
        // Not a security token, so the faster thread-local generator is fine.
        return String.format("%016x%016x", random.nextLong(), random.nextLong());
    }

}
