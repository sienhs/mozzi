package com.ssafy.mozzi.global.exception;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;

import com.ssafy.mozzi.global.logging.RequestTrace;
import com.ssafy.mozzi.support.IntegrationTest;

/**
 * The filter-chain half of the error contract.
 *
 * <p>Authentication and rate limiting reject a request before
 * {@link GlobalExceptionHandler} can see it, so this writer produces those bodies. It uses
 * the application's own mapper, which is what keeps the two paths from drifting — a test
 * here that mirrors {@link ErrorResponseContractTest} is the only thing that catches a
 * drift, since no controller is involved.
 */
@IntegrationTest
class ErrorResponseWriterTest {

    @Autowired
    private ErrorResponseWriter writer;

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void writesTheCodesOwnStatusAndMessage() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        writer.write(response, CommonErrorCode.TOKEN_EXPIRED);

        assertThat(response.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
        assertThat(response.getContentType()).startsWith(MediaType.APPLICATION_JSON_VALUE);
        assertThat(response.getContentAsString())
                .contains("\"code\":\"TOKEN_EXPIRED\"")
                .contains(CommonErrorCode.TOKEN_EXPIRED.message());
    }

    /** Same four keys as the controller path, including the null that is kept. */
    @Test
    void bodyHasTheSameShapeAsTheControllerPath() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        writer.write(response, CommonErrorCode.UNAUTHORIZED);

        assertThat(response.getContentAsString())
                .contains("\"code\":")
                .contains("\"message\":")
                .contains("\"fieldErrors\":null")
                .contains("\"traceId\":");
    }

    @Test
    void picksUpTheTraceIdOfTheRunningRequest() throws Exception {
        MDC.put(RequestTrace.TRACE_ID, "0af7651916cd43dd8448eb211c80319c");
        MockHttpServletResponse response = new MockHttpServletResponse();

        writer.write(response, CommonErrorCode.UNAUTHORIZED);

        assertThat(response.getContentAsString()).contains("0af7651916cd43dd8448eb211c80319c");
    }

    @Test
    void writesKoreanWithoutMangling() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();

        writer.write(response, CommonErrorCode.ONBOARDING_REQUIRED);

        assertThat(response.getCharacterEncoding()).isEqualToIgnoringCase("UTF-8");
        assertThat(response.getContentAsString(java.nio.charset.StandardCharsets.UTF_8))
                .contains(CommonErrorCode.ONBOARDING_REQUIRED.message());
    }

    @Test
    void supportsADomainCodeWithFieldErrors() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        ErrorResponse body = ErrorResponse.of(CommonErrorCode.INVALID_INPUT,
                List.of(new ErrorResponse.FieldError("memo", "100자 이하로 입력해 주세요.")), "abc");

        writer.write(response, HttpStatus.BAD_REQUEST, body);

        assertThat(response.getStatus()).isEqualTo(400);
        assertThat(response.getContentAsString()).contains("\"field\":\"memo\"");
    }

    /** Appending JSON to a response that already started streaming yields an unparsable body. */
    @Test
    void doesNothingOnceTheResponseIsCommitted() throws Exception {
        MockHttpServletResponse response = new MockHttpServletResponse();
        response.getWriter().write("partial");
        response.flushBuffer();

        writer.write(response, CommonErrorCode.INTERNAL_ERROR);

        assertThat(response.getContentAsString()).isEqualTo("partial");
    }

}
