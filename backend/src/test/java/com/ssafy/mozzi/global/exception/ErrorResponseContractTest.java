package com.ssafy.mozzi.global.exception;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.webmvc.test.autoconfigure.MockMvcBuilderCustomizer;
import org.springframework.context.annotation.Primary;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.mozzi.global.logging.RequestTrace;
import com.ssafy.mozzi.global.security.AccessSessionChecker;
import com.ssafy.mozzi.global.security.AccessTokenProvider;
import com.ssafy.mozzi.support.IntegrationTest;

/**
 * Pins the error body from API spec 1.2 and the {@code /api/v1} prefix from spec 1.
 *
 * <p>These are contracts shared by every endpoint, so they are verified against a throwaway
 * controller rather than waiting for a real domain: a change here breaks the whole client at
 * once.
 *
 * <p>Every request carries a valid access token, and the session check always passes, so
 * these tests see the dispatcher's behaviour rather than the authentication filter's.
 * Authentication has its own tests ({@code AuthFlowTest}).
 */
@IntegrationTest
@AutoConfigureMockMvc
class ErrorResponseContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void businessExceptionReturnsItsCodeAndUserMessage() throws Exception {
        mockMvc.perform(get("/api/v1/trial/not-found"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value(CommonErrorCode.NOT_FOUND.message()));
    }

    @Test
    void logDetailOfABusinessExceptionIsNotSentToTheClient() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/trial/not-found")).andReturn();

        assertThat(result.getResponse().getContentAsString()).doesNotContain(TrialController.LOG_DETAIL);
    }

    /**
     * Spec 1.1 keeps keys the client branches on present even when they carry no value, so
     * {@code fieldErrors} has to be null rather than absent.
     */
    @Test
    void bodyAlwaysCarriesTheSameFourKeys() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/trial/not-found")).andReturn();

        assertThat(result.getResponse().getContentAsString())
                .contains("\"code\":")
                .contains("\"message\":")
                .contains("\"fieldErrors\":null")
                .contains("\"traceId\":");
    }

    @Test
    void bodyValidationReportsEveryFieldWithItsReason() throws Exception {
        String body = """
                {"emotion": null, "memo": "too long for the limit"}
                """;

        mockMvc.perform(post("/api/v1/trial/diaries").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors.length()").value(2))
                .andExpect(jsonPath("$.fieldErrors[*].field").value(
                        org.hamcrest.Matchers.containsInAnyOrder("emotion", "memo")))
                .andExpect(jsonPath("$.fieldErrors[*].reason").value(
                        org.hamcrest.Matchers.everyItem(org.hamcrest.Matchers.not(org.hamcrest.Matchers.blankOrNullString()))));
    }

    /**
     * An enum value the server does not know must be a 400, not the 500 that an unhandled
     * {@code HttpMessageNotReadableException} would produce.
     */
    @Test
    void unknownEnumValueIsRejectedAsInvalidInput() throws Exception {
        String body = """
                {"emotion": "ECSTATIC", "memo": "ok"}
                """;

        mockMvc.perform(post("/api/v1/trial/diaries").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
    }

    /** The parser quotes the payload, which here would mean diary text in the response. */
    @Test
    void parseFailureDoesNotEchoThePayload() throws Exception {
        String body = "{\"emotion\": \"CALM\", \"memo\": \"오므라이스를 만들어 먹었어\"";

        MvcResult result = mockMvc
                .perform(post("/api/v1/trial/diaries").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andReturn();

        assertThat(result.getResponse().getContentAsString()).doesNotContain("오므라이스");
    }

    @Test
    void unknownBodyFieldIsRejected() throws Exception {
        String body = """
                {"emotion": "CALM", "memo": "ok", "emtion": "typo"}
                """;

        mockMvc.perform(post("/api/v1/trial/diaries").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"));
    }

    @Test
    void parameterTypeMismatchNamesTheParameter() throws Exception {
        mockMvc.perform(get("/api/v1/trial/sized").param("size", "many"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("size"));
    }

    @Test
    void missingRequiredParameterNamesTheParameter() throws Exception {
        mockMvc.perform(get("/api/v1/trial/sized"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("size"));
    }

    @Test
    void constrainedParameterReportsItsOwnName() throws Exception {
        mockMvc.perform(get("/api/v1/trial/nickname").param("nickname", "열자가넘는아주긴닉네임입니다"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_INPUT"))
                .andExpect(jsonPath("$.fieldErrors[0].field").value("nickname"));
    }

    @Test
    void unknownPathIsNotFound() throws Exception {
        mockMvc.perform(get("/api/v1/trial/no-such-thing"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void wrongHttpMethodIsMethodNotAllowed() throws Exception {
        mockMvc.perform(post("/api/v1/trial/not-found"))
                .andExpect(status().isMethodNotAllowed())
                .andExpect(jsonPath("$.code").value("METHOD_NOT_ALLOWED"));
    }

    @Test
    void unsupportedContentTypeIsRejected() throws Exception {
        mockMvc.perform(post("/api/v1/trial/diaries").contentType(MediaType.TEXT_PLAIN).content("emotion=CALM"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_MEDIA_TYPE"));
    }

    @Test
    void unexpectedExceptionIsReplacedByAFixedSentence() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/trial/boom"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.code").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.message").value(CommonErrorCode.INTERNAL_ERROR.message()))
                .andReturn();

        assertThat(result.getResponse().getContentAsString()).doesNotContain(TrialController.INTERNAL_DETAIL);
    }

    @Test
    void errorBodyIsJsonWithTheTraceIdAlsoOnAHeader() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/v1/trial/not-found"))
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(header().exists(RequestTrace.TRACE_ID_HEADER))
                .andReturn();

        String traceId = result.getResponse().getHeader(RequestTrace.TRACE_ID_HEADER);
        assertThat(traceId).matches("[0-9a-f]{32}");
        assertThat(result.getResponse().getContentAsString()).contains("\"traceId\":\"" + traceId + "\"");
    }

    @Test
    void actuatorIsNotMovedUnderTheApiPrefix() throws Exception {
        // The prefix predicate is restricted to this project's packages. Actuator has its own
        // handler mapping and must stay where the Kubernetes probes look for it.
        mockMvc.perform(get("/actuator/health")).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/actuator/health")).andExpect(status().isNotFound());
    }

    @Test
    void controllersAreReachableOnlyUnderTheApiPrefix() throws Exception {
        mockMvc.perform(get("/api/v1/trial/ok")).andExpect(status().isOk());
        mockMvc.perform(get("/trial/ok")).andExpect(status().isNotFound());
    }

    @Test
    void errorBodyIsJsonWhateverTheClientAccepts() throws Exception {
        // Negotiating the error body against Accept found no converter for XML, so the
        // handler itself failed and the client got an empty 500.
        mockMvc.perform(get("/api/v1/trial/not-found").accept(MediaType.APPLICATION_XML))
                .andExpect(status().isNotFound())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value("NOT_FOUND"));
    }

    @Test
    void unsupportedAcceptOnASuccessfulRequestIsNotAcceptable() throws Exception {
        mockMvc.perform(get("/api/v1/trial/record").accept(MediaType.APPLICATION_XML))
                .andExpect(status().isNotAcceptable())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.code").value("NOT_ACCEPTABLE"));
    }

    @TestConfiguration
    static class TrialConfig {

        @org.springframework.context.annotation.Bean
        TrialController trialController() {
            return new TrialController();
        }

        @org.springframework.context.annotation.Bean
        @Primary
        AccessSessionChecker everySessionIsCurrent() {
            return (memberId, sessionId) -> true;
        }

        @org.springframework.context.annotation.Bean
        MockMvcBuilderCustomizer authenticatedByDefault(AccessTokenProvider accessTokenProvider) {
            String token = accessTokenProvider.issue(1L, UUID.randomUUID()).token();
            return builder -> builder.defaultRequest(get("/").header(HttpHeaders.AUTHORIZATION, "Bearer " + token));
        }

    }

    @RestController
    @RequestMapping("/trial")
    static class TrialController {

        static final String LOG_DETAIL = "diary 999 belongs to member 7";
        static final String INTERNAL_DETAIL = "jdbc connection string leaked here";

        @GetMapping("/ok")
        String ok() {
            return "ok";
        }

        @GetMapping("/not-found")
        String notFound() {
            throw new BusinessException(CommonErrorCode.NOT_FOUND, LOG_DETAIL);
        }

        @GetMapping("/boom")
        String boom() {
            throw new IllegalStateException(INTERNAL_DETAIL);
        }

        @GetMapping("/sized")
        String sized(@RequestParam int size) {
            return String.valueOf(size);
        }

        @GetMapping("/nickname")
        String nickname(@RequestParam @Size(max = 10) String nickname) {
            return nickname;
        }

        @PostMapping("/diaries")
        String createDiary(@Valid @RequestBody TrialRequest request) {
            return request.memo();
        }

        // Not a String: StringHttpMessageConverter writes any media type, so it could not
        // show a negotiation failure.
        @GetMapping("/record")
        TrialRecord record() {
            return new TrialRecord("ok");
        }

    }

    record TrialRecord(String value) {
    }

    record TrialRequest(@NotNull TrialEmotion emotion, @Size(max = 5) String memo) {
    }

    enum TrialEmotion {
        HAPPY, CALM
    }

}
