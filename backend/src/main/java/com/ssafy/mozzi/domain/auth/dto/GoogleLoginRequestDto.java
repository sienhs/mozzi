package com.ssafy.mozzi.domain.auth.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * @param idToken the Google ID token from Credential Manager, requested for the server's Web
 *                client id. The size cap only stops oversized junk before it is parsed
 */
public record GoogleLoginRequestDto(@NotBlank @Size(max = 4096) String idToken) {
}
