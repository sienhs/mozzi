package com.ssafy.mozzi.integration.gms;

import java.net.http.HttpClient;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

@Configuration
public class GmsConfig {

    /**
     * Without timeouts a slow GMS holds a request thread for as long as it likes, and emotion
     * search has to answer within 10 seconds (spec).
     */
    @Bean
    RestClient gmsRestClient(GmsProperties properties) {
        HttpClient httpClient = HttpClient.newBuilder()
                .connectTimeout(properties.connectTimeout())
                .build();
        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(httpClient);
        requestFactory.setReadTimeout(properties.readTimeout());
        return configure(RestClient.builder().requestFactory(requestFactory), properties).build();
    }

    /** Everything but the transport, so tests can put a mock server under the same setup. */
    static RestClient.Builder configure(RestClient.Builder builder, GmsProperties properties) {
        return builder
                .baseUrl(properties.baseUrl().toString())
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + properties.apiKey());
    }

}
