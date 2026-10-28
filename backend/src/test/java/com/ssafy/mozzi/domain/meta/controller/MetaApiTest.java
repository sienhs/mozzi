package com.ssafy.mozzi.domain.meta.controller;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;

import com.ssafy.mozzi.support.IntegrationTest;

/**
 * {@code GET /meta} end to end.
 */
@IntegrationTest
@AutoConfigureMockMvc
class MetaApiTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void answersWithoutAnAccessTokenWithTermsAndAppVersions() throws Exception {
        mockMvc.perform(get("/api/v1/meta"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.termsVersions.TERMS").value("1.0"))
                .andExpect(jsonPath("$.termsVersions.PRIVACY").value("1.0"))
                .andExpect(jsonPath("$.minSupportedVersion").value("1.0.0"))
                .andExpect(jsonPath("$.latestVersion").value("1.0.0"));
    }

}
