package com.ssafy.mozzi.integration.gms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.header;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.method;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withException;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withServerError;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import java.net.SocketTimeoutException;
import java.net.URI;
import java.time.Duration;
import java.util.List;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import tools.jackson.databind.DeserializationFeature;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.json.JsonMapper;

/** Runs the real client against a mock server standing in for GMS. */
class GmsEmbeddingClientTest {

    /** Three dimensions keep the canned vectors readable. */
    private static final GmsProperties PROPERTIES = new GmsProperties(
            URI.create("https://gms.test/v1"), "test-key", "gpt-6-luna", "none", 1000,
            "text-embedding-3-large", 3, Duration.ofSeconds(2), Duration.ofSeconds(5));

    /** Rejects unknown properties, as the application's mapper does (application.yml). */
    private static final ObjectMapper MAPPER = JsonMapper.builder()
            .enable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
            .build();

    private final RestClient.Builder builder = GmsConfig.configure(RestClient.builder(), PROPERTIES);
    private final MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    private final GmsEmbeddingClient client = new GmsEmbeddingClient(builder.build(), PROPERTIES, MAPPER);

    /** Fields the client does not read must not break it; OpenAI adds them over time. */
    @Test
    void sendsModelDimensionsAndKeyAndReadsTheVector() {
        server.expect(requestTo("https://gms.test/v1/embeddings"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header(HttpHeaders.AUTHORIZATION, "Bearer test-key"))
                .andExpect(jsonPath("$.model").value("text-embedding-3-large"))
                .andExpect(jsonPath("$.dimensions").value(3))
                .andExpect(jsonPath("$.input[0]").value("오늘은 마음이 편했다"))
                .andRespond(withSuccess("""
                        {"object": "list", "model": "text-embedding-3-large",
                         "data": [{"object": "embedding", "index": 0, "embedding": [0.5, -0.25, 1.0]}],
                         "usage": {"prompt_tokens": 9, "total_tokens": 9},
                         "field_added_next_year": true}
                        """, MediaType.APPLICATION_JSON));

        float[] vector = client.embed("오늘은 마음이 편했다");

        assertThat(vector).containsExactly(0.5f, -0.25f, 1.0f);
        server.verify();
    }

    @Test
    void vectorsFollowTheInputOrderNotTheResponseOrder() {
        server.expect(requestTo("https://gms.test/v1/embeddings"))
                .andRespond(withSuccess("""
                        {"data": [{"index": 1, "embedding": [0, 0, 1]},
                                  {"index": 0, "embedding": [1, 0, 0]}]}
                        """, MediaType.APPLICATION_JSON));

        List<float[]> vectors = client.embedAll(List.of("first", "second"));

        assertThat(vectors.get(0)).containsExactly(1f, 0f, 0f);
        assertThat(vectors.get(1)).containsExactly(0f, 0f, 1f);
    }

    /** A vector of another size cannot go into vector(1536) or be compared with the rest. */
    @Test
    void vectorOfTheWrongSizeIsRejected() {
        server.expect(requestTo("https://gms.test/v1/embeddings"))
                .andRespond(withSuccess("""
                        {"data": [{"index": 0, "embedding": [1, 0]}]}
                        """, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.embed("text"))
                .isInstanceOf(GmsUnavailableException.class)
                .hasMessageContaining("2 dimensions");
    }

    @Test
    void missingVectorIsRejected() {
        server.expect(requestTo("https://gms.test/v1/embeddings"))
                .andRespond(withSuccess("""
                        {"data": [{"index": 0, "embedding": [1, 0, 0]}]}
                        """, MediaType.APPLICATION_JSON));

        assertThatThrownBy(() -> client.embedAll(List.of("first", "second")))
                .isInstanceOf(GmsUnavailableException.class)
                .hasMessageContaining("input 1");
    }

    /** The body can echo the request, which is diary text; only the status may surface. */
    @Test
    void errorStatusSurfacesWithoutTheBody() {
        server.expect(requestTo("https://gms.test/v1/embeddings"))
                .andRespond(withServerError().body("could not embed: 오늘은 마음이 편했다"));

        assertThatThrownBy(() -> client.embed("오늘은 마음이 편했다"))
                .isInstanceOf(GmsUnavailableException.class)
                .hasMessage("embeddings answered 500")
                .hasNoCause();
    }

    /** readTree(null) would throw IllegalArgumentException, which escapes as a 500. */
    @Test
    void emptyBodyIsUnavailable() {
        server.expect(requestTo("https://gms.test/v1/embeddings")).andRespond(withSuccess());

        assertThatThrownBy(() -> client.embed("text"))
                .isInstanceOf(GmsUnavailableException.class)
                .hasMessage("embeddings answered an empty body");
    }

    @Test
    void timeoutIsUnavailable() {
        server.expect(requestTo("https://gms.test/v1/embeddings"))
                .andRespond(withException(new SocketTimeoutException("read timed out")));

        assertThatThrownBy(() -> client.embed("text"))
                .isInstanceOf(GmsUnavailableException.class)
                .hasMessage("embeddings call failed");
    }

    @Test
    void storedModelIdCarriesTheDimensions() {
        assertThat(PROPERTIES.embeddingModelId()).isEqualTo("text-embedding-3-large@3");
    }

}
