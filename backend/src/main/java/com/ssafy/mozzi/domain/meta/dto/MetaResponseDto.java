package com.ssafy.mozzi.domain.meta.dto;

import java.util.Map;

import com.ssafy.mozzi.domain.member.entity.TermsType;

/**
 * Body of {@code GET /meta}.
 *
 * @param termsVersions the versions {@code POST /auth/signup} expects in {@code agreedTerms}
 * @param termsPaths    where each document's HTML page is served, relative to the server's
 *                      origin (not under {@code /api/v1})
 */
public record MetaResponseDto(
        Map<TermsType, String> termsVersions,
        Map<TermsType, String> termsPaths,
        String minSupportedVersion,
        String latestVersion) {
}
