package com.ssafy.mozzi.domain.auth.dto;

import java.time.OffsetDateTime;

import com.ssafy.mozzi.domain.auth.service.IssuedTokens;

/**
 * {@code POST /auth/google}: either the account exists and is now logged in, or a nickname is
 * needed first. The app branches on {@code status}.
 */
public sealed interface GoogleLoginResponseDto {

    String LOGIN_SUCCESS = "LOGIN_SUCCESS";
    String SIGNUP_REQUIRED = "SIGNUP_REQUIRED";

    String status();

    record LoginSuccess(
            String status,
            String accessToken,
            String refreshToken,
            OffsetDateTime accessExpiresAt,
            OffsetDateTime refreshExpiresAt) implements GoogleLoginResponseDto {

        public static LoginSuccess from(IssuedTokens tokens) {
            return new LoginSuccess(LOGIN_SUCCESS, tokens.accessToken(), tokens.refreshToken(),
                    tokens.accessExpiresAt(), tokens.refreshExpiresAt());
        }

    }

    /**
     * @param signupToken     single-use ticket to submit with the nickname
     * @param signupExpiresAt after this the user has to start again from Google sign-in
     */
    record SignupRequired(String status, String signupToken, OffsetDateTime signupExpiresAt)
            implements GoogleLoginResponseDto {

        public static SignupRequired of(String signupToken, OffsetDateTime signupExpiresAt) {
            return new SignupRequired(SIGNUP_REQUIRED, signupToken, signupExpiresAt);
        }

    }

}
