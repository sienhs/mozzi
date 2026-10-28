package com.ssafy.mozzi.integration.gms;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;

import com.ssafy.mozzi.domain.image.service.PromptTranslator;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * Translates picture inputs with a chat model on GMS, all four in one call.
 *
 * <p>The model answers in JSON mode. Bodies are written and read with the application's
 * {@link ObjectMapper} as plain strings, and the answer is read as a tree, so the strict
 * "unknown property" setting meant for requests from the app does not reject GMS's extra
 * fields. Nothing the member wrote is logged.
 */
public class GmsPromptTranslator implements PromptTranslator {

    /**
     * Rules for phrases an image model can use. Romanised Korean ("chimaek", "PC bang") came
     * out of several models in the comparison, and an image model cannot draw a word it does
     * not know, so the rule asks for a plain description instead.
     */
    static final String SYSTEM_PROMPT = """
            You translate Korean picture-diary inputs into short English phrases for an image \
            generation prompt. Return only a JSON object with the same keys. Rules: \
            'where' is a place phrase starting with a preposition (e.g. "at home"); \
            'who' is a companion phrase starting with "with" (e.g. "with mom"); \
            'what' is an activity as a gerund phrase (e.g. "cooking dinner"); \
            'character' is a concise visual description of the character. \
            Never leave Korean words romanised: describe them in plain English \
            (치맥 -> "eating fried chicken and beer", PC방 -> "at an internet cafe", \
            코노 -> "at a coin karaoke booth"). Do not add details that are not in the input. \
            A null value stays null.""";

    private static final Logger log = LoggerFactory.getLogger(GmsPromptTranslator.class);

    private final RestClient restClient;
    private final ObjectMapper objectMapper;
    private final String model;

    /**
     * @param gmsRestClient the shared GMS client from {@link GmsConfig}: base URL, key and
     *                      timeouts are the same as emotion search's
     */
    public GmsPromptTranslator(RestClient gmsRestClient, String model, ObjectMapper objectMapper) {
        this.restClient = gmsRestClient;
        this.objectMapper = objectMapper;
        this.model = model;
    }

    @Override
    public Translation translate(Source source) {
        long started = System.nanoTime();
        String answer = restClient.post()
                .uri("/chat/completions")
                .contentType(MediaType.APPLICATION_JSON)
                .body(objectMapper.writeValueAsString(requestBody(source)))
                .retrieve()
                .body(String.class);

        JsonNode response = objectMapper.readTree(answer);
        JsonNode content = objectMapper.readTree(response.path("choices").path(0).path("message").path("content").asString());
        Translation translation = new Translation(
                text(content, "where"), text(content, "who"), text(content, "what"), text(content, "character"));
        if (translation.what() == null) {
            throw new IllegalStateException("GMS answer has no 'what'");
        }
        log.info("image pipeline: step=gms-answered model={} tokens={} millis={}",
                model, response.path("usage").path("total_tokens").asInt(), (System.nanoTime() - started) / 1_000_000);
        return translation;
    }

    private Map<String, Object> requestBody(Source source) {
        Map<String, Object> input = new LinkedHashMap<>();
        input.put("where", source.where());
        input.put("who", source.who());
        input.put("what", source.what());
        input.put("character", source.character());

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("temperature", 0);
        body.put("response_format", Map.of("type", "json_object"));
        body.put("messages", List.of(
                Map.of("role", "system", "content", SYSTEM_PROMPT),
                Map.of("role", "user", "content", objectMapper.writeValueAsString(input))));
        return body;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) {
            return null;
        }
        String text = value.asString().strip();
        return text.isEmpty() ? null : text;
    }

}
