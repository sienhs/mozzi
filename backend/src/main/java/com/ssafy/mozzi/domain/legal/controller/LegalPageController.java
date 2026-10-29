package com.ssafy.mozzi.domain.legal.controller;

import java.nio.charset.StandardCharsets;
import java.time.Duration;

import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

import com.ssafy.mozzi.domain.legal.service.LegalDocuments;
import com.ssafy.mozzi.domain.member.entity.TermsType;

/**
 * Public HTML pages for the terms and the privacy policy (docs/legal/README.md).
 *
 * <p>A plain {@code @Controller}, so {@code WebConfig} does not put it under {@code /api/v1}:
 * these are pages people open in a browser, and the store listing links to them.
 */
@Controller
public class LegalPageController {

    private static final MediaType HTML = new MediaType(MediaType.TEXT_HTML, StandardCharsets.UTF_8);

    private final LegalDocuments legalDocuments;

    public LegalPageController(LegalDocuments legalDocuments) {
        this.legalDocuments = legalDocuments;
    }

    @GetMapping(value = "/legal/terms", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> terms() {
        return page(TermsType.TERMS);
    }

    @GetMapping(value = "/legal/privacy", produces = MediaType.TEXT_HTML_VALUE)
    public ResponseEntity<String> privacy() {
        return page(TermsType.PRIVACY);
    }

    private ResponseEntity<String> page(TermsType type) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                .contentType(HTML)
                .body(legalDocuments.html(type));
    }

}
