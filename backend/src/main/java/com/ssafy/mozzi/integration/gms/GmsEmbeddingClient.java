package com.ssafy.mozzi.integration.gms;

import java.util.List;
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
 * Turns text into vectors through GMS's OpenAI embeddings API ({@code POST /embeddings}).
 *
 * <p>Bodies go out and come back as bytes through the application's mapper. The response
 * is read as a tree rather than bound to a class: the application rejects unknown JSON
 * properties (application.yml), so a field OpenAI adds tomorrow would otherwise break every
 * call.
 */
@Component
public class GmsEmbeddingClient {

    private final RestClient gmsRestClient;
    private final GmsProperties properties;
    private final ObjectMapper objectMapper;

    public GmsEmbeddingClient(RestClient gmsRestClient, GmsProperties properties, ObjectMapper objectMapper) {
        this.gmsRestClient = gmsRestClient;
        this.properties = properties;
        this.objectMapper = objectMapper;
    }

    /** @see #embedAll(List) */
    public float[] embed(String text) {
        return embedAll(List.of(text)).get(0);
    }

    /**
     * One vector per text, in the order given. OpenAI takes up to 2,048 inputs per call;
     * callers that embed in bulk send them in batches well below that.
     *
     * @throws GmsUnavailableException no usable answer, including a vector whose size is not
     *                                 the configured dimensions
     */
    public List<float[]> embedAll(List<String> texts) {
        Map<String, Object> request = Map.of(
                "model", properties.embeddingModel(),
                "dimensions", properties.embeddingDimensions(),
                "input", texts);
        JsonNode response = post(request);

        float[][] vectors = new float[texts.size()][];
        for (JsonNode item : response.path("data")) {
            int index = item.path("index").asInt(-1);
            if (index < 0 || index >= vectors.length) {
                throw new GmsUnavailableException("embedding index out of range: " + index);
            }
            vectors[index] = toVector(item.path("embedding"));
        }
        for (int i = 0; i < vectors.length; i++) {
            if (vectors[i] == null) {
                throw new GmsUnavailableException("embedding missing for input " + i);
            }
        }
        return List.of(vectors);
    }

    private JsonNode post(Map<String, Object> request) {
        byte[] body;
        try {
            body = gmsRestClient.post()
                    .uri("/embeddings")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(objectMapper.writeValueAsBytes(request))
                    .retrieve()
                    .body(byte[].class);
        } catch (RestClientResponseException e) {
            // Not chained: its message quotes the response body.
            throw new GmsUnavailableException("embeddings answered " + e.getStatusCode().value());
        } catch (RestClientException e) {
            throw new GmsUnavailableException("embeddings call failed", e);
        }
        if (body == null || body.length == 0) {
            // readTree(null) throws IllegalArgumentException, which is not a JacksonException
            // and would surface as a 500.
            throw new GmsUnavailableException("embeddings answered an empty body");
        }
        try {
            return objectMapper.readTree(body);
        } catch (JacksonException e) {
            throw new GmsUnavailableException("embeddings answered malformed JSON");
        }
    }

    private float[] toVector(JsonNode embedding) {
        if (!embedding.isArray() || embedding.size() != properties.embeddingDimensions()) {
            // A vector of another size cannot be stored (vector(1536)) or compared, so it is
            // as useless as no answer.
            throw new GmsUnavailableException("embedding has " + embedding.size() + " dimensions, expected "
                    + properties.embeddingDimensions());
        }
        float[] vector = new float[embedding.size()];
        for (int i = 0; i < vector.length; i++) {
            vector[i] = embedding.get(i).floatValue();
        }
        return vector;
    }

}
