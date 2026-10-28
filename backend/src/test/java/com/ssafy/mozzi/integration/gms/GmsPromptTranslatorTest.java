package com.ssafy.mozzi.integration.gms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import com.ssafy.mozzi.domain.image.exception.InappropriatePromptException;
import com.ssafy.mozzi.domain.image.service.PromptTranslator;
import com.sun.net.httpserver.HttpServer;

import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Against a local stand-in for GMS. {@link #liveGms} calls the real one when
 * {@code GMS_API_KEY} is set, to check the chosen model still answers in the expected shape.
 */
class GmsPromptTranslatorTest {

    private static final PromptTranslator.Source SOURCE =
            new PromptTranslator.Source("한강 공원", "남자친구", "치맥");

    private final JsonMapper objectMapper = new JsonMapper();
    private final AtomicReference<String> requestBody = new AtomicReference<>();
    private final AtomicReference<String> authorization = new AtomicReference<>();
    private final AtomicReference<String> answer = new AtomicReference<>();
    private HttpServer server;

    @BeforeEach
    void setUp() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/v1/chat/completions", exchange -> {
            requestBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            authorization.set(exchange.getRequestHeaders().getFirst("Authorization"));
            byte[] body = answer.get().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(body);
            }
        });
        server.start();
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    @Test
    void sendsTheTagsInOneJsonModeCallAndReadsTheAnswer() {
        answer.set(completion("""
                {"where": "at a riverside park", "who": "with a boyfriend", "what": "eating fried chicken and beer", "blocked": false}
                """));

        PromptTranslator.Translation translation = translator().translate(SOURCE);

        assertThat(translation).isEqualTo(new PromptTranslator.Translation(
                "at a riverside park", "with a boyfriend", "eating fried chicken and beer"));
        JsonNode sent = objectMapper.readTree(requestBody.get());
        assertThat(sent.path("model").asString()).isEqualTo("gpt-4.1-mini");
        assertThat(sent.path("response_format").path("type").asString()).isEqualTo("json_object");
        JsonNode input = objectMapper.readTree(sent.path("messages").path(1).path("content").asString());
        assertThat(input.path("what").path(0).asString()).isEqualTo("치맥");
        assertThat(input.path("where").asString()).isEqualTo("한강 공원");
        assertThat(input.path("who").path(0).asString()).isEqualTo("남자친구");
        assertThat(input.path("myTags").isEmpty()).isTrue();
        assertThat(input.has("character")).isFalse();
        assertThat(authorization.get()).isEqualTo("Bearer test-key");
    }

    @Test
    void absentPicksComeBackNull() {
        answer.set(completion("""
                {"where": "", "who": "", "what": "cooking", "blocked": false}
                """));

        PromptTranslator.Translation translation = translator().translate(
                new PromptTranslator.Source(null, null, "요리"));

        assertThat(translation.where()).isNull();
        assertThat(translation.who()).isNull();
        assertThat(translation.what()).isEqualTo("cooking");
        JsonNode input = objectMapper.readTree(
                objectMapper.readTree(requestBody.get()).path("messages").path(1).path("content").asString());
        assertThat(input.path("where").asString()).isEmpty();
        assertThat(input.path("who").isEmpty()).isTrue();
    }

    @Test
    void anAnswerWithoutWhatIsAnError() {
        answer.set(completion("{\"where\": \"at home\", \"blocked\": false}"));

        assertThatThrownBy(() -> translator().translate(SOURCE)).isInstanceOf(IllegalStateException.class);
    }

    @Test
    void aBlockedAnswerIsRejected() {
        answer.set(completion("""
                {"where": "", "who": "", "what": "", "blocked": true}
                """));

        assertThatThrownBy(() -> translator().translate(SOURCE)).isInstanceOf(InappropriatePromptException.class);
        assertThat(requestBody.get()).contains("blocked");
    }

    /** A missing verdict is not read as allowed. */
    @Test
    void anAnswerWithoutAVerdictIsAnError() {
        answer.set(completion("""
                {"where": "at home", "who": "", "what": "cooking"}
                """));

        assertThatThrownBy(() -> translator().translate(SOURCE))
                .isInstanceOf(IllegalStateException.class)
                .isNotInstanceOf(InappropriatePromptException.class);
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "GMS_API_KEY", matches = ".+")
    void liveGms() {
        GmsPromptTranslator live = new GmsPromptTranslator(
                restClient("https://gms.ssafy.io/gmsapi/api.openai.com/v1", System.getenv("GMS_API_KEY"),
                        Duration.ofSeconds(20)),
                "gpt-4.1-mini", objectMapper);

        PromptTranslator.Translation translation = live.translate(SOURCE);

        assertThat(translation.where()).isNotBlank();
        assertThat(translation.who()).startsWith("with");
        assertThat(translation.what()).doesNotContainIgnoringCase("chimaek");
    }

    @Test
    @EnabledIfEnvironmentVariable(named = "GMS_API_KEY", matches = ".+")
    void liveGmsBlocksProfanity() {
        GmsPromptTranslator live = new GmsPromptTranslator(
                restClient("https://gms.ssafy.io/gmsapi/api.openai.com/v1", System.getenv("GMS_API_KEY"),
                        Duration.ofSeconds(20)),
                "gpt-4.1-mini", objectMapper);

        assertThatThrownBy(() -> live.translate(new PromptTranslator.Source("우리집", "씨1발놈", "요리")))
                .isInstanceOf(InappropriatePromptException.class);
    }

    /** Glossary tags come back with the glossary English. */
    @Test
    @EnabledIfEnvironmentVariable(named = "GMS_API_KEY", matches = ".+")
    void liveGmsUsesTheGlossary() {
        GmsPromptTranslator live = new GmsPromptTranslator(
                restClient("https://gms.ssafy.io/gmsapi/api.openai.com/v1", System.getenv("GMS_API_KEY"),
                        Duration.ofSeconds(20)),
                "gpt-4.1-mini", objectMapper);

        assertThat(live.translate(new PromptTranslator.Source("집", "가족", "요리")))
                .isEqualTo(new PromptTranslator.Translation("at home", "with family", "cooking"));
    }

    private GmsPromptTranslator translator() {
        return new GmsPromptTranslator(
                restClient("http://127.0.0.1:" + server.getAddress().getPort() + "/v1", "test-key", Duration.ofSeconds(5)),
                "gpt-4.1-mini", objectMapper);
    }

    /** Set up like {@code GmsConfig#gmsRestClient}: base URL, bearer key, timeouts. */
    private static RestClient restClient(String baseUrl, String key, Duration timeout) {
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(
                HttpClient.newBuilder().connectTimeout(timeout).build());
        requestFactory.setReadTimeout(timeout);
        return RestClient.builder()
                .requestFactory(requestFactory)
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + key)
                .build();
    }

    private String completion(String content) {
        return objectMapper.writeValueAsString(Map.of(
                "choices", List.of(Map.of("message", Map.of("content", content))),
                "usage", Map.of("total_tokens", 200)));
    }

}
