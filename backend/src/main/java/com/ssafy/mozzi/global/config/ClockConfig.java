package com.ssafy.mozzi.global.config;

import java.time.Clock;
import java.time.ZoneId;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * The single source of "now" for the application.
 *
 * <p>The API spec puts real rules on the current date: a diary may only be written for
 * today, with a three-hour grace window just after midnight (spec 4.4, policy 1). That
 * logic cannot be tested against the machine clock, so everything date-dependent takes this
 * {@link Clock} as a dependency and tests substitute {@link Clock#fixed}.
 *
 * <p>{@code ArchitectureTest} fails the build on a no-argument {@code LocalDate.now()} and
 * friends, because such a call compiles and works while quietly bypassing the test seam.
 */
@Configuration
public class ClockConfig {

    /** Server timezone fixed by spec 1; the container sets the same value for the JVM. */
    public static final ZoneId SERVICE_ZONE = ZoneId.of("Asia/Seoul");

    @Bean
    public Clock clock() {
        return Clock.system(SERVICE_ZONE);
    }

}
