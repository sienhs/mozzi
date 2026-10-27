package com.ssafy.mozzi.global.security;

import java.util.Set;
import jakarta.servlet.http.HttpServletRequest;

import com.ssafy.mozzi.global.config.WebConfig;

/**
 * The only requests that pass without an access token.
 *
 * <p>Each entry is an HTTP method plus an exact path. There are no wildcards on purpose:
 * {@code /api/v1/auth/**} would also open logout, and a prefix or {@code contains} match can
 * be stretched to cover paths nobody meant to publish. A path written differently from the
 * entry (trailing slash, {@code ;} parameters, double slashes) is simply not public, so any
 * mismatch fails closed.
 *
 * <p>The three auth endpoints are public only in the sense that they skip the access token.
 * Each one verifies its own credential: the Google ID token, the sign-up ticket or the
 * refresh token.
 */
final class PublicEndpoints {

    private static final Set<String> ENDPOINTS = Set.of(
            "POST " + WebConfig.API_PREFIX + "/auth/google",
            "POST " + WebConfig.API_PREFIX + "/auth/signup",
            "POST " + WebConfig.API_PREFIX + "/auth/refresh",
            // Kubernetes probes (deployment.yaml) and the bare health check.
            "GET /actuator/health",
            "GET /actuator/health/liveness",
            "GET /actuator/health/readiness");

    private PublicEndpoints() {
    }

    static boolean matches(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return ENDPOINTS.contains(request.getMethod() + " " + path);
    }

}
