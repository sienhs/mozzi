package com.ssafy.mozzi.global.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.ZoneOffset;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.ssafy.mozzi.support.IntegrationTest;

@IntegrationTest
class ClockConfigTest {

    @Autowired
    private Clock clock;

    @Test
    void clockIsOnTheServiceTimezone() {
        assertThat(clock.getZone()).isEqualTo(ZoneId.of("Asia/Seoul"));
    }

    /**
     * The case the grace window in spec 4.4 exists for: just after midnight in Seoul it is
     * still the previous afternoon in UTC, so a UTC clock would file the diary under
     * yesterday's date.
     */
    @Test
    void justAfterMidnightInSeoulIsAlreadyTheNextDay() {
        Clock fixed = Clock.fixed(Instant.parse("2026-10-22T15:30:00Z"), ClockConfig.SERVICE_ZONE);

        assertThat(LocalDate.now(fixed)).isEqualTo(LocalDate.of(2026, 10, 23));
        assertThat(LocalDate.now(Clock.fixed(Instant.parse("2026-10-22T15:30:00Z"), ZoneOffset.UTC)))
                .isEqualTo(LocalDate.of(2026, 10, 22));
    }

}
