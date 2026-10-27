package com.ssafy.mozzi.global.config;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.temporal.TemporalAccessor;
import java.util.Optional;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.auditing.DateTimeProvider;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * Enables {@code @CreatedDate} / {@code @LastModifiedDate} on
 * {@link com.ssafy.mozzi.global.entity.BaseTimeEntity}.
 *
 * <p>Spring Data's default provider reads the machine clock. That would make
 * {@code created_at} the one timestamp in the application that a test cannot move, and it
 * would quietly sidestep the {@code Clock} bean that every other date rule goes through.
 * Pointing the provider at the bean keeps a single source of "now".
 *
 * @see ClockConfig
 */
@Configuration
@EnableJpaAuditing(dateTimeProviderRef = "auditingDateTimeProvider")
public class JpaAuditingConfig {

    @Bean
    public DateTimeProvider auditingDateTimeProvider(Clock clock) {
        return new ClockDateTimeProvider(clock);
    }

    private record ClockDateTimeProvider(Clock clock) implements DateTimeProvider {

        @Override
        public Optional<TemporalAccessor> getNow() {
            return Optional.of(OffsetDateTime.now(clock));
        }

    }

}
