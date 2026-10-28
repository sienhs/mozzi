package com.ssafy.mozzi.domain.meta.service;

import org.springframework.stereotype.Service;

import com.ssafy.mozzi.domain.member.service.TermsProperties;
import com.ssafy.mozzi.domain.meta.dto.MetaResponseDto;

/**
 * What the app reads once at start-up, before anyone signs in.
 *
 * <p>Terms versions come from the same properties sign-up checks against, so the two cannot
 * drift apart.
 */
@Service
public class MetaService {

    private final TermsProperties termsProperties;
    private final AppVersionProperties appVersionProperties;

    public MetaService(TermsProperties termsProperties, AppVersionProperties appVersionProperties) {
        this.termsProperties = termsProperties;
        this.appVersionProperties = appVersionProperties;
    }

    public MetaResponseDto get() {
        return new MetaResponseDto(
                termsProperties.currentVersions(),
                appVersionProperties.minSupportedVersion(),
                appVersionProperties.latestVersion());
    }

}
