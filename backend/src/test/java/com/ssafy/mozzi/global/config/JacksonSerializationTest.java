package com.ssafy.mozzi.global.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.OffsetTime;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

import com.ssafy.mozzi.support.IntegrationTest;

import tools.jackson.databind.ObjectMapper;

/**
 * Pins the JSON formats the API spec commits to.
 *
 * <p>Asserting the output rather than trusting defaults matters more than usual here:
 * Boot 4 ships Jackson 3, which moved date handling from {@code SerializationFeature} to
 * {@code DateTimeFeature} and changed several defaults. A Boot 2/3 configuration key for
 * any of this still looks right in review but no longer reaches the mapper.
 */
@IntegrationTest
class JacksonSerializationTest {

    @Autowired
    private ObjectMapper objectMapper;

    /** Spec 1: ISO-8601 with the Asia/Seoul offset, for example 2026-10-22T21:12:00+09:00. */
    @Test
    void timestampsKeepTheSeoulOffset() {
        OffsetDateTime createdAt = OffsetDateTime.parse("2026-10-22T21:12:00+09:00");

        String json = objectMapper.writeValueAsString(new Timestamped(createdAt));

        assertThat(json).isEqualTo("{\"createdAt\":\"2026-10-22T21:12:00+09:00\"}");
    }

    /** The same instant sent as UTC must come back rendered in the service timezone. */
    @Test
    void utcInputIsRenderedInTheServiceTimezone() {
        OffsetDateTime createdAt = OffsetDateTime.parse("2026-10-22T12:12:00Z");

        String json = objectMapper.writeValueAsString(new Timestamped(createdAt));

        assertThat(json).isEqualTo("{\"createdAt\":\"2026-10-22T21:12:00+09:00\"}");
    }

    @Test
    void timestampsAreNeverEpochNumbers() {
        String json = objectMapper.writeValueAsString(new Timestamped(OffsetDateTime.parse("2026-10-22T21:12:00+09:00")));

        assertThat(json).doesNotContain("1792");
    }

    /** Spec 1: plain dates are YYYY-MM-DD. */
    @Test
    void datesAreIsoStrings() {
        String json = objectMapper.writeValueAsString(new Dated(LocalDate.of(2026, 10, 22)));

        assertThat(json).isEqualTo("{\"recordDate\":\"2026-10-22\"}");
    }

    /** Times go out as ISO strings, not arrays. */
    @Test
    void timesAreIsoStrings() {
        String json = objectMapper.writeValueAsString(new Reminder(OffsetTime.parse("21:00+09:00").toLocalTime()));

        assertThat(json).isEqualTo("{\"reminderTime\":\"21:00:00\"}");
    }

    /**
     * Spec 1.1 keeps null keys: the client reads {@code todayDiary} unconditionally and
     * branches on its value, so dropping the key would break that check.
     */
    @Test
    void nullFieldsKeepTheirKey() {
        String json = objectMapper.writeValueAsString(new Home(null));

        assertThat(json).isEqualTo("{\"todayDiary\":null}");
    }

    /** A misspelled request field is a client bug and has to surface as one. */
    @Test
    void unknownRequestFieldIsRejected() {
        assertThatThrownBy(() -> objectMapper.readValue("{\"recordDate\":\"2026-10-22\",\"typo\":1}", Dated.class))
                .isInstanceOf(RuntimeException.class);
    }

    record Timestamped(OffsetDateTime createdAt) {
    }

    record Dated(LocalDate recordDate) {
    }

    record Reminder(java.time.LocalTime reminderTime) {
    }

    record Home(String todayDiary) {
    }

}
