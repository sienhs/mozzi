package com.ssafy.mozzi.integration.gms;

import java.util.Map;

import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Asks the chat model through GMS's OpenAI Responses API ({@code POST /responses}) and
 * reads the answer as JSON.
 *
 * <p>Every call asks for a strict JSON Schema answer. Free text would leave the caller
 * parsing prose, and the schema's {@code enum}s keep emotion and activity codes to the ones
 * that exist.
 *
 * <p>The response is read as a tree for the same reason as in {@link GmsEmbeddingClient}.
 */
@Component
public class GmsLlmClient {

    private final RestClient gmsRestClient;
    private final GmsProperties properties;
    private final ObjectMapper objectMapper;

    public GmsLlmClient(RestClient gmsRestClient, GmsProperties properties, ObjectMapper objectMapper) {
        this.gmsRestClient = gmsRestClient;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    /**
     * <p>Binding succeeding does not mean the schema was followed: a property sent as
     * {@code null} binds as {@code null}. Callers check the fields they rely on.
     *
     * @param answerType record matching {@link GmsPrompt#schema()}
     * @throws GmsUnavailableException no usable answer: a failed call, a refusal, an answer
     *                                 cut off by the token limit, or JSON that does not bind
     *                                 to {@code answerType}
     */
    public <T> T respond(GmsPrompt prompt, Class<T> answerType) {
        Map<String, Object> request = Map.of(
                "model", properties.chatModel(),
                // The Responses API keeps requests for 30 days unless told otherwise, and the
                // input holds diary text. Nothing here needs a stored response.
                "store", false,
                "reasoning", Map.of("effort", properties.reasoningEffort()),
                "max_output_tokens", properties.maxOutputTokens(),
                "instructions", prompt.instructions(),
                "input", prompt.input(),
                "text", Map.of("format", Map.of(
                        "type", "json_schema",
                        "name", prompt.schemaName(),
                        "strict", true,
                        "schema", prompt.schema())));
        String answer = answerText(post(request));
        T bound;
        try {
            bound = objectMapper.readValue(answer, answerType);
        } catch (JacksonException e) {
            // Not chained: the exception quotes the answer, which repeats diary text.
            throw new GmsUnavailableException("answer does not match " + answerType.getSimpleName());
        }
        if (bound == null) {
            // The text "null" binds without an error.
            throw new GmsUnavailableException("answer is null");
        }
        return bound;
    }

    private JsonNode post(Map<String, Object> request) {
        byte[] body;
        try {
            body = gmsRestClient.post()
                    .uri("/responses")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(objectMapper.writeValueAsBytes(request))
                    .retrieve()
                    .body(byte[].class);
        } catch (RestClientResponseException e) {
            // Not chained: its message quotes the response body.
            throw new GmsUnavailableException("responses answered " + e.getStatusCode().value());
        } catch (RestClientException e) {
            throw new GmsUnavailableException("responses call failed", e);
        }
        if (body == null || body.length == 0) {
            // readTree(null) throws IllegalArgumentException, which is not a JacksonException
            // and would surface as a 500.
            throw new GmsUnavailableException("responses answered an empty body");
        }
        try {
            return objectMapper.readTree(body);
        } catch (JacksonException e) {
            throw new GmsUnavailableException("responses answered malformed JSON");
        }
    }

    /**
     * The text of the message item. {@code output} also holds a {@code reasoning} item first
     * when the model reasons, so the message is looked up by type rather than position.
     */
    private static String answerText(JsonNode response) {
        String status = response.path("status").asString("");
        if (!"completed".equals(status)) {
            // "incomplete" means max_output_tokens cut the JSON off half way.
            String reason = response.path("incomplete_details").path("reason").asString("");
            throw new GmsUnavailableException("response " + status + (reason.isEmpty() ? "" : " (" + reason + ")"));
        }
        for (JsonNode item : response.path("output")) {
            if (!"message".equals(item.path("type").asString(""))) {
                continue;
            }
            for (JsonNode content : item.path("content")) {
                String type = content.path("type").asString("");
                if ("refusal".equals(type)) {
                    throw new GmsUnavailableException("model refused");
                }
                if ("output_text".equals(type)) {
                    return content.path("text").asString("");
                }
            }
        }
        throw new GmsUnavailableException("response has no output text");
    }

}
