package com.ssafy.mozzi.domain.auth;

import static org.mockito.BDDMockito.given;

import org.springframework.jdbc.core.JdbcTemplate;

import com.ssafy.mozzi.integration.google.GoogleIdTokenVerifier;
import com.ssafy.mozzi.integration.google.GoogleIdentity;

/** Shared fixtures for the auth integration tests. */
final class AuthTestSupport {

    static final String SIGNUP_BODY = """
            {"signupToken": "%s", "nickname": "%s",
             "agreedTerms": [{"type": "TERMS", "version": "1.0"}, {"type": "PRIVACY", "version": "1.0"}]}
            """;

    private AuthTestSupport() {
    }

    /** Truncate cascades to every table referencing member (sessions, settings, diaries). */
    static void clearAuthTables(JdbcTemplate jdbcTemplate) {
        jdbcTemplate.execute("truncate table member cascade");
        jdbcTemplate.update("delete from signup_ticket");
    }

    /** Makes the mocked verifier accept {@code idToken} as the given Google account. */
    static void googleAccepts(GoogleIdTokenVerifier verifier, String idToken, String subject, String email) {
        given(verifier.verify(idToken)).willReturn(new GoogleIdentity(subject, email));
    }

}
