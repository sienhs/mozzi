package com.ssafy.mozzi.domain.legal.dto;

import com.ssafy.mozzi.domain.member.entity.TermsType;

/**
 * {@code GET /legal/terms}, {@code GET /legal/privacy}. Same shape as the app's bundled
 * {@code assets/legal/*.json}, plus the type and version.
 *
 * @param version the version {@code POST /auth/signup} expects, as in {@code GET /meta}
 * @param body    Markdown; starts with the title heading
 */
public record LegalDocumentResponseDto(TermsType type, String version, String title, String body) {
}
