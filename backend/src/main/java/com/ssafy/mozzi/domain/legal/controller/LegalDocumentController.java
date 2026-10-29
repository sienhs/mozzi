package com.ssafy.mozzi.domain.legal.controller;

import java.time.Duration;

import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.ssafy.mozzi.domain.legal.dto.LegalDocumentResponseDto;
import com.ssafy.mozzi.domain.legal.service.LegalDocumentService;
import com.ssafy.mozzi.domain.member.entity.TermsType;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

/**
 * The terms as JSON for the app, which draws the Markdown itself. Public: they are read
 * before sign-up (see {@code PublicEndpoints}). The same text is also a browser page at
 * {@code /legal/*} ({@link LegalPageController}).
 */
@Tag(name = "약관")
@RestController
@RequestMapping("/legal")
public class LegalDocumentController {

    private final LegalDocumentService legalDocumentService;

    public LegalDocumentController(LegalDocumentService legalDocumentService) {
        this.legalDocumentService = legalDocumentService;
    }

    @Operation(summary = "이용약관", description = "인증 없음. body는 마크다운.")
    @GetMapping("/terms")
    public ResponseEntity<LegalDocumentResponseDto> terms() {
        return document(TermsType.TERMS);
    }

    @Operation(summary = "개인정보 처리방침", description = "인증 없음. body는 마크다운.")
    @GetMapping("/privacy")
    public ResponseEntity<LegalDocumentResponseDto> privacy() {
        return document(TermsType.PRIVACY);
    }

    private ResponseEntity<LegalDocumentResponseDto> document(TermsType type) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                .body(legalDocumentService.get(type));
    }

}
