package com.ssafy.mozzi.domain.diary.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZonedDateTime;

import org.junit.jupiter.api.Test;

import com.ssafy.mozzi.domain.diary.exception.DiaryErrorCode;
import com.ssafy.mozzi.global.config.ClockConfig;
import com.ssafy.mozzi.global.exception.BusinessException;

/**
 * Spec 4.4 / policy 1: today only, plus the previous day until 03:00.
 */
class RecordDatePolicyTest {

    private static final LocalDate OCT_22 = LocalDate.of(2026, 10, 22);
    private static final LocalDate OCT_21 = OCT_22.minusDays(1);

    @Test
    void todayIsAllowed() {
        assertThat(policyAt("2026-10-22T21:12:00").isAllowed(OCT_22)).isTrue();
    }

    @Test
    void yesterdayIsAllowedJustAfterMidnight() {
        assertThat(policyAt("2026-10-22T00:05:00").isAllowed(OCT_21)).isTrue();
        assertThat(policyAt("2026-10-22T02:59:59").isAllowed(OCT_21)).isTrue();
    }

    @Test
    void graceWindowEndsAtThree() {
        assertThat(policyAt("2026-10-22T03:00:00").isAllowed(OCT_21)).isFalse();
    }

    @Test
    void twoDaysAgoIsNeverAllowed() {
        assertThat(policyAt("2026-10-22T00:05:00").isAllowed(OCT_22.minusDays(2))).isFalse();
    }

    @Test
    void tomorrowIsNeverAllowed() {
        assertThat(policyAt("2026-10-22T23:59:00").isAllowed(OCT_22.plusDays(1))).isFalse();
    }

    /**
     * "Today" is Seoul's today. At 23:30 UTC on the 21st it is already 08:30 on the 22nd in
     * Seoul, so a UTC-minded check would accept the wrong day.
     */
    @Test
    void todayIsTheServiceTimezonesToday() {
        Clock clock = Clock.fixed(
                ZonedDateTime.parse("2026-10-21T23:30:00Z").toInstant(), ClockConfig.SERVICE_ZONE);
        RecordDatePolicy policy = new RecordDatePolicy(clock);

        assertThat(policy.isAllowed(OCT_22)).isTrue();
        assertThat(policy.isAllowed(OCT_21)).isFalse();
    }

    @Test
    void rejectionCarriesTheSpecCode() {
        assertThatThrownBy(() -> policyAt("2026-10-22T12:00:00").validate(OCT_21))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).errorCode())
                .isEqualTo(DiaryErrorCode.INVALID_RECORD_DATE);
    }

    private static RecordDatePolicy policyAt(String seoulLocalDateTime) {
        ZonedDateTime now = ZonedDateTime.of(
                LocalDateTime.parse(seoulLocalDateTime), ClockConfig.SERVICE_ZONE);
        return new RecordDatePolicy(Clock.fixed(now.toInstant(), ClockConfig.SERVICE_ZONE));
    }

}
