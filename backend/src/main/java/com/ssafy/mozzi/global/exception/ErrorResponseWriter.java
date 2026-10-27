package com.ssafy.mozzi.global.exception;

import java.io.IOException;
import jakarta.servlet.http.HttpServletResponse;

import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

import com.ssafy.mozzi.global.logging.RequestTrace;

import tools.jackson.databind.ObjectMapper;

/**
 * Writes an {@link ErrorResponse} straight onto the servlet response.
 *
 * <p>Spring Security's {@code AuthenticationEntryPoint} and {@code AccessDeniedHandler}
 * run inside the filter chain, where {@link GlobalExceptionHandler} is not reachable.
 * Both sides go through this writer so 401/403 bodies cannot drift from the rest of the API.
 */
@Component
public class ErrorResponseWriter {

    private final ObjectMapper objectMapper;

    public ErrorResponseWriter(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /** Writes the code's own message and status, with the current request's trace id. */
    public void write(HttpServletResponse response, ErrorCode errorCode) throws IOException {
        write(response, errorCode.status(), ErrorResponse.of(errorCode, RequestTrace.traceId()));
    }

    public void write(HttpServletResponse response, HttpStatus status, ErrorResponse body) throws IOException {
        if (response.isCommitted()) {
            // Something already started streaming a response; appending JSON would produce
            // a body the client cannot parse.
            return;
        }
        response.setStatus(status.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        objectMapper.writeValue(response.getWriter(), body);
    }

}
