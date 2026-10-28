package com.ssafy.mozzi.domain.meta.service;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

/**
 * App versions the server announces in {@code GET /meta}, under {@code mozzi.app}.
 *
 * <p>Only an app released with the check honours these, so raising the minimum cannot stop
 * a build that shipped before it.
 *
 * @param minSupportedVersion an app below this version must update before it can be used
 * @param latestVersion       an app below this version is offered an update but keeps working
 */
@Validated
@ConfigurationProperties("mozzi.app")
public record AppVersionProperties(
        @NotBlank @Pattern(regexp = SEMVER) String minSupportedVersion,
        @NotBlank @Pattern(regexp = SEMVER) String latestVersion) {

    /** {@code major.minor.patch}, no leading zeros, so the app can compare part by part as numbers. */
    static final String SEMVER = "(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)";

    /**
     * A minimum above the latest would force members onto a version the server calls newest
     * and still refuses, so that configuration fails start-up. Malformed values are left to
     * {@code @Pattern}, which reports them by name.
     */
    public AppVersionProperties {
        if (minSupportedVersion != null && latestVersion != null
                && minSupportedVersion.matches(SEMVER) && latestVersion.matches(SEMVER)
                && compare(minSupportedVersion, latestVersion) > 0) {
            throw new IllegalArgumentException("mozzi.app.min-supported-version " + minSupportedVersion
                    + " is above latest-version " + latestVersion);
        }
    }

    static int compare(String a, String b) {
        String[] left = a.split("\\.");
        String[] right = b.split("\\.");
        for (int i = 0; i < 3; i++) {
            int result = Long.compare(Long.parseLong(left[i]), Long.parseLong(right[i]));
            if (result != 0) {
                return result;
            }
        }
        return 0;
    }
}
