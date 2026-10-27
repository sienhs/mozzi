package com.ssafy.mozzi.global.logging;

import java.io.IOException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * One access-log line per request: method, path, status, duration.
 *
 * <p>Deliberately logs no request or response body and no query string. This service
 * handles diary text, search questions, Google id tokens and FCM tokens, and all of those
 * travel in bodies or query parameters — {@code ?nickname=하루} in spec 4.2 is a query
 * string with personal data in it. A denylist of fields to hide would leak every time a new
 * field is added, so nothing from either payload is logged at all.
 *
 * <p>When a specific payload has to be inspected, log it from the service that owns it and
 * run the value through {@link com.ssafy.mozzi.global.util.Masker} first.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class RequestLoggingFilter extends OncePerRequestFilter {

    private static final Logger log = LoggerFactory.getLogger(RequestLoggingFilter.class);

    private static final String ACTUATOR_PATH = "/actuator";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        // Kubernetes probes hit the health endpoints every few seconds; logging them would
        // bury real traffic.
        return request.getRequestURI().startsWith(ACTUATOR_PATH);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        long startedAt = System.nanoTime();
        try {
            chain.doFilter(request, response);
        } finally {
            long tookMs = (System.nanoTime() - startedAt) / 1_000_000L;
            log.info("{} {} -> {} ({} ms)",
                    request.getMethod(), request.getRequestURI(), response.getStatus(), tookMs);
        }
    }

}
