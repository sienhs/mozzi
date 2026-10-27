package com.ssafy.mozzi.domain.auth.controller;

import jakarta.validation.Valid;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.dao.TransientDataAccessException;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.transaction.CannotCreateTransactionException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.mozzi.domain.auth.dto.GoogleLoginRequestDto;
import com.ssafy.mozzi.domain.auth.dto.GoogleLoginResponseDto;
import com.ssafy.mozzi.domain.auth.dto.RefreshRequestDto;
import com.ssafy.mozzi.domain.auth.dto.SignupRequestDto;
import com.ssafy.mozzi.domain.auth.dto.TokenResponseDto;
import com.ssafy.mozzi.domain.auth.service.AuthService;
import com.ssafy.mozzi.global.exception.ErrorResponse;
import com.ssafy.mozzi.global.exception.ErrorResponseEntity;
import com.ssafy.mozzi.global.logging.RequestTrace;
import com.ssafy.mozzi.global.security.AuthenticatedMember;
import com.ssafy.mozzi.global.security.SecurityErrorCode;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * Login, sign-up, refresh and logout.
 *
 * <p>Google login, sign-up and refresh are on the filter's public list; each checks its own
 * credential instead of an access token. Logout needs the access token like any other API.
 *
 * <p>Responses carrying tokens are marked {@code no-store} so no cache keeps them.
 */
@Tag(name = "인증", description = "docs/AUTH_API.md")
@RestController
@RequestMapping("/auth")
public class AuthController {

    private static final Logger log = LoggerFactory.getLogger(AuthController.class);

    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @Operation(summary = "Google 로그인", description = "기존 회원은 토큰, 신규 회원은 가입 티켓을 받는다.")
    @PostMapping("/google")
    public ResponseEntity<GoogleLoginResponseDto> loginWithGoogle(@Valid @RequestBody GoogleLoginRequestDto request) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(authService.loginWithGoogle(request.idToken()));
    }

    @Operation(summary = "회원 가입")
    @ApiResponse(responseCode = "201", description = "가입 후 토큰 발급")
    @PostMapping("/signup")
    public ResponseEntity<TokenResponseDto> signUp(@Valid @RequestBody SignupRequestDto request) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .cacheControl(CacheControl.noStore())
                .body(TokenResponseDto.from(
                        authService.signUp(request.signupToken(), request.nickname(), request.agreements())));
    }

    @Operation(summary = "토큰 재발급")
    @PostMapping("/refresh")
    public ResponseEntity<TokenResponseDto> refresh(@Valid @RequestBody RefreshRequestDto request) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(TokenResponseDto.from(authService.refresh(request.refreshToken())));
    }

    @Operation(summary = "로그아웃", description = "현재 세션을 종료한다.")
    @ApiResponse(responseCode = "204", description = "로그아웃됨")
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(AuthenticatedMember member) {
        authService.logout(member);
        return ResponseEntity.noContent().build();
    }

    /**
     * The database being unreachable is an outage, not a bad credential. Answering with a
     * 401 code here would make the app delete tokens that are still valid.
     */
    @ExceptionHandler({CannotCreateTransactionException.class, DataAccessResourceFailureException.class,
            TransientDataAccessException.class})
    public ResponseEntity<ErrorResponse> handleDatabaseUnavailable(Exception e) {
        log.error("auth request failed on the database", e);
        SecurityErrorCode code = SecurityErrorCode.AUTH_SERVICE_UNAVAILABLE;
        return ErrorResponseEntity.of(code, RequestTrace.traceId());
    }

}
