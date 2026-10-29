package com.ssafy.mozzi.domain.legal.controller;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import com.ssafy.mozzi.support.IntegrationTest;

/**
 * The terms end to end, from docs/legal: pages at {@code /legal/*} and JSON at
 * {@code /api/v1/legal/*}, both public.
 */
@IntegrationTest
@AutoConfigureMockMvc
class LegalPageApiTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void servesTheTermsAsHtmlWithoutAnAccessToken() throws Exception {
        mockMvc.perform(get("/legal/terms"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.TEXT_HTML))
                .andExpect(content().string(containsString("<title>이용약관</title>")))
                .andExpect(content().string(containsString("<h2>")))
                .andExpect(content().string(not(containsString("## "))));
    }

    @Test
    void servesThePrivacyPolicyWithItsTables() throws Exception {
        mockMvc.perform(get("/legal/privacy"))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("<title>개인정보 처리방침</title>")))
                .andExpect(content().string(containsString("<table>")));
    }

    /** The app's JSON: the same text as Markdown, with the version sign-up expects. */
    @Test
    void servesTheTermsAsJsonForTheAppWithoutAnAccessToken() throws Exception {
        mockMvc.perform(get("/api/v1/legal/terms"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.type").value("TERMS"))
                .andExpect(jsonPath("$.version").value("1.0"))
                .andExpect(jsonPath("$.title").value("이용약관"))
                .andExpect(jsonPath("$.body").value(startsWith("# 이용약관\n")));
        mockMvc.perform(get("/api/v1/legal/privacy"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.type").value("PRIVACY"))
                .andExpect(jsonPath("$.title").value("개인정보 처리방침"))
                .andExpect(jsonPath("$.body").value(containsString("| 업체 |")));
    }

}
