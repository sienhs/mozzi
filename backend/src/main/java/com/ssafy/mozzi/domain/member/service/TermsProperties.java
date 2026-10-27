package com.ssafy.mozzi.domain.member.service;

import java.util.Map;
import jakarta.validation.constraints.NotEmpty;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

import com.ssafy.mozzi.domain.member.entity.TermsType;

/**
 * Documents a new member has to agree to, under {@code mozzi.terms}.
 *
 * @param currentVersions the version of each required document the app must show and
 *                        submit. Publishing a new version means changing it here, after
 *                        which sign-ups that submit the old version are refused
 */
@Validated
@ConfigurationProperties("mozzi.terms")
public record TermsProperties(@NotEmpty Map<TermsType, String> currentVersions) {
}
