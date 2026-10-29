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
public final class PublicEndpoints {

    private static final Set<String> ENDPOINTS = Set.of(
            "POST " + WebConfig.API_PREFIX + "/auth/google",
            "POST " + WebConfig.API_PREFIX + "/auth/signup",
            "POST " + WebConfig.API_PREFIX + "/auth/refresh",
            // Read at start-up, before sign-up: terms versions and the update check.
            "GET " + WebConfig.API_PREFIX + "/meta",
            // Terms, read before sign-up: as JSON for the app (LegalDocumentController) and as
            // pages for browsers and the store listing (LegalPageController).
            "GET " + WebConfig.API_PREFIX + "/legal/terms",
            "GET " + WebConfig.API_PREFIX + "/legal/privacy",
            "GET /legal/terms",
            "GET /legal/privacy",
            // Kubernetes probes (deployment.yaml) and the bare health check.
            "GET /actuator/health",
            "GET /actuator/health/liveness",
            "GET /actuator/health/readiness",
            // Swagger UI: the page, the files index.html loads, and the two documents it
            // fetches. Listed one by one for the same reason as above; a file a future
            // swagger-ui adds shows up as a broken page, not as an opened path. The prod
            // profile turns springdoc off, and then these answer 404.
            "GET /swagger-ui.html",
            "GET /swagger-ui/index.html",
            "GET /swagger-ui/index.css",
            "GET /swagger-ui/swagger-ui.css",
            "GET /swagger-ui/swagger-ui-bundle.js",
            "GET /swagger-ui/swagger-ui-standalone-preset.js",
            "GET /swagger-ui/swagger-initializer.js",
            "GET /swagger-ui/favicon-32x32.png",
            "GET /swagger-ui/favicon-16x16.png",
            "GET /v3/api-docs",
            "GET /v3/api-docs/swagger-config");

    private PublicEndpoints() {
    }

    static boolean matches(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return contains(request.getMethod(), path);
    }

    /** Also read by {@code OpenApiConfig}, so the docs show the lock exactly where the filter wants a token. */
    public static boolean contains(String method, String path) {
        return ENDPOINTS.contains(method + " " + path);
    }

}
