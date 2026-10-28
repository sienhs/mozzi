package com.ssafy.mozzi.domain.meta.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class AppVersionPropertiesTest {

    @Test
    void comparesEachPartAsANumber() {
        assertThat(AppVersionProperties.compare("1.10.0", "1.9.0")).isPositive();
        assertThat(AppVersionProperties.compare("1.2.3", "1.2.3")).isZero();
        assertThat(AppVersionProperties.compare("0.9.9", "1.0.0")).isNegative();
    }

    @Test
    void minimumAboveLatestIsRefused() {
        assertThatThrownBy(() -> new AppVersionProperties("2.0.0", "1.5.0"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("2.0.0");
    }

    @Test
    void minimumEqualToLatestIsAllowed() {
        assertThat(new AppVersionProperties("1.5.0", "1.5.0").latestVersion()).isEqualTo("1.5.0");
    }

    @Test
    void leadingZerosDoNotMatchTheFormat() {
        assertThat("01.0.0".matches(AppVersionProperties.SEMVER)).isFalse();
        assertThat("1.0.0".matches(AppVersionProperties.SEMVER)).isTrue();
    }

}
