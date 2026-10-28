package com.ssafy.mozzi.integration.gms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withStatus;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/** Runs the real client against a mock server standing in for GMS. */
class GmsLlmClientTest {

    private static final GmsProperties PROPERTIES = new GmsProperties(
            URI.create("https://gms.test/v1"), "test-key", "gpt-6-luna", "none", 1000,
            "text-embedding-3-large", 1536, Duration.ofSeconds(2), Duration.ofSeconds(5));

    /** Rejects unknown properties, as the application's mapper does (application.yml). */
    private static final ObjectMapper MAPPER = JsonMapper.builder()
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    private static final GmsPrompt PROMPT = new GmsPrompt(
            "질문을 조건으로 바꿔라.", "마음이 편했던 날 보여 줘", "filter",
            Map.of("type", "object",
                    "additionalProperties", false,
                    "required", List.of("emotions", "keyword"),
                    "properties", Map.of(
                            "emotions", Map.of("type", "array", "items", Map.of("type", "string")),
                            "keyword", Map.of("type", List.of("string", "null")))));

    private final RestClient.Builder builder = GmsConfig.configure(RestClient.builder(), PROPERTIES);
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final GmsLlmClient client = new GmsLlmClient(builder.build(), PROPERTIES, MAPPER);

    record Filter(List<String> emotions, String keyword) {
    }

    /**
     * The shape GMS answered with for gpt-6-luna (verified): a reasoning item ahead of the
     * message, and many top-level fields the client has no use for.
     */
    @Test
    void sendsAStrictSchemaRequestAndBindsTheMessageText() {
        server.expect(requestTo("https://gms.test/v1/responses"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer test-key"))
                .andExpect(jsonPath("$.model").value("gpt-6-luna"))
                .andExpect(jsonPath("$.store").value(false))
                .andExpect(jsonPath("$.reasoning.effort").value("none"))
                .andExpect(jsonPath("$.max_output_tokens").value(1000))
                .andExpect(jsonPath("$.instructions").value("질문을 조건으로 바꿔라."))
                .andExpect(jsonPath("$.input").value("마음이 편했던 날 보여 줘"))
                .andExpect(jsonPath("$.text.format.type").value("json_schema"))
                .andExpect(jsonPath("$.text.format.name").value("filter"))
                .andExpect(jsonPath("$.text.format.strict").value(true))
                .andExpect(jsonPath("$.text.format.schema.additionalProperties").value(false))
                .andRespond(withSuccess("""
                        {"id": "resp_1", "object": "response", "status": "completed",
                         "billing": {"payer": "developer"},
                         "output": [
                           {"id": "rs_1", "type": "reasoning", "content": [], "encrypted_content": "gAAA"},
                           {"id": "msg_1", "type": "message", "status": "completed", "role": "assistant",
                            "content": [{"type": "output_text", "annotations": [],
                                         "text": "{\\"emotions\\":[\\"CALM\\"],\\"keyword\\":null}"}]}
                         ],
                         "usage": {"input_tokens": 245, "output_tokens": 47}}
                        """, MediaType.APPLICATION_JSON));

        Filter filter = client.respond(PROMPT, Filter.class);

        assertThat(filter).isEqualTo(new Filter(List.of("CALM"), null));
        server.verify();
    }

    @Test
    void refusalIsUnavailable() {
        server.expect(requestTo("https://gms.test/v1/responses"))
                .andRespond(withSuccess("""
                        {"status": "completed",
                         "output": [{"type": "message",
                                     "content": [{"type": "refusal", "refusal": "I can't help with that."}]}]}
                        """, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.respond(PROMPT, Filter.class))
                .isInstanceOf(GmsUnavailableException.class)
                .hasMessage("model refused");
    }

    /** max_output_tokens cut the JSON off half way; binding what is there would fail anyway. */
    @Test
    void answerCutOffByTheTokenLimitIsUnavailable() {
        server.expect(requestTo("https://gms.test/v1/responses"))
                .andRespond(withSuccess("""
                        {"status": "incomplete", "incomplete_details": {"reason": "max_output_tokens"},
                         "output": [{"type": "message",
                                     "content": [{"type": "output_text", "text": "{\\"emotions\\":[\\"CA"}]}]}
                        """, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.respond(PROMPT, Filter.class))
                .isInstanceOf(GmsUnavailableException.class)
                .hasMessage("response incomplete (max_output_tokens)");
    }

    /** The answer repeats diary text, so it must not reach the message or a cause. */
    @Test
    void answerThatDoesNotBindIsUnavailableWithoutQuotingIt() {
        server.expect(requestTo("https://gms.test/v1/responses"))
                .andRespond(withSuccess("""
                        {"status": "completed",
                         "output": [{"type": "message",
                                     "content": [{"type": "output_text", "text": "{\\"memo\\":\\"엄마랑 산책\\"}"}]}]}
                        """, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.respond(PROMPT, Filter.class))
                .isInstanceOf(GmsUnavailableException.class)
                .hasMessage("answer does not match Filter")
                .hasNoCause();
    }

    @Test
    void responseWithoutAMessageIsUnavailable() {
        server.expect(requestTo("https://gms.test/v1/responses"))
                .andRespond(withSuccess("""
                        {"status": "completed", "output": [{"type": "reasoning", "content": []}]}
                        """, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.respond(PROMPT, Filter.class))
                .isInstanceOf(GmsUnavailableException.class)
                .hasMessage("response has no output text");
    }

    /** readTree(null) would throw IllegalArgumentException, which escapes as a 500. */
    @Test
    void emptyBodyIsUnavailable() {
        server.expect(requestTo("https://gms.test/v1/responses")).andRespond(withSuccess());

        assertThatThrownBy(() -> client.respond(PROMPT, Filter.class))
                .isInstanceOf(GmsUnavailableException.class)
                .hasMessage("responses answered an empty body");
    }

    @Test
    void rateLimitSurfacesAsItsStatus() {
        server.expect(requestTo("https://gms.test/v1/responses"))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS).body("{\"error\": {\"message\": \"slow down\"}}"));

        assertThatThrownBy(() -> client.respond(PROMPT, Filter.class))
                .isInstanceOf(GmsUnavailableException.class)
                .hasMessage("responses answered 429")
                .hasNoCause();
    }

}
