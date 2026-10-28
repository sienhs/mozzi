package com.ssafy.mozzi.integration.gms;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.client.RestClient;

import com.ssafy.mozzi.domain.image.service.ImageProperties;
import com.ssafy.mozzi.domain.image.service.PromptTranslator;

import tools.jackson.databind.ObjectMapper;

/**
 * The picture translator, on the same GMS connection emotion search uses
 * ({@link GmsConfig#gmsRestClient}).
 */
@Configuration
public class GmsTranslationConfig {

    /**
     * Off locally and in tests ({@code mozzi.image.translate}), where there is no real key:
     * inputs then go out untranslated instead of every request failing on a 401.
     */
    @Bean
    PromptTranslator promptTranslator(
            ImageProperties imageProperties,
            RestClient gmsRestClient,
            GmsTranslationProperties properties,
            ObjectMapper objectMapper) {
        return imageProperties.translate()
                ? new GmsPromptTranslator(gmsRestClient, properties.translationModel(), objectMapper)
                : new UntranslatedPromptTranslator();
    }

}
