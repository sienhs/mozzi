package com.ssafy.mozzi.global.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerAdapter;

import com.ssafy.mozzi.support.IntegrationTest;

/**
 * Pins what {@link WebConfig} does to the dispatcher: the {@code /api/v1} prefix reaches our
 * controllers only, and the API speaks JSON only.
 *
 * <p>Uses {@code /auth/refresh} because it is public, so the request reaches the dispatcher
 * without a token.
 */
@IntegrationTest
@AutoConfigureMockMvc
class WebConfigTest {

    private static final String REFRESH = WebConfig.API_PREFIX + "/auth/refresh";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RequestMappingHandlerAdapter handlerAdapter;

    @Test
    void prefixAppliesToOurControllersButNotToSpringdoc() throws Exception {
        mockMvc.perform(get("/v3/api-docs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.paths['/api/v1/diaries']").exists());
    }

    @Test
    void noConverterSpeaksYaml() {
        // Covers responses too: with a YAML converter, Accept: application/yaml got a YAML body
        // that ignored spring.jackson.*.
        assertThat(handlerAdapter.getMessageConverters())
                .noneMatch(converter -> converter.getSupportedMediaTypes().contains(MediaType.APPLICATION_YAML));
    }

    @Test
    void yamlRequestBodyIsRejected() throws Exception {
        // Through a YAML converter the unknown field would be ignored and the token checked.
        mockMvc.perform(post(REFRESH)
                .contentType(MediaType.APPLICATION_YAML)
                .content("refreshToken: x\ntypo: 1\n"))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.code").value("UNSUPPORTED_MEDIA_TYPE"));
    }

}
