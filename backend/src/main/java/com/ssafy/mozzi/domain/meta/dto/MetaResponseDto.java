package com.ssafy.mozzi.domain.meta.dto;

import java.util.Map;

import com.ssafy.mozzi.domain.member.entity.TermsType;

/**
 * Body of {@code GET /meta}.
 *
 * @param termsVersions the versions {@code POST /auth/signup} expects in {@code agreedTerms}
 */
public record MetaResponseDto(
        Map<TermsType, String> termsVersions,
        String minSupportedVersion,
        String latestVersion) {
}
