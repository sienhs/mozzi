package com.ssafy.mozzi.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/**
 * Turns on {@code @Scheduled} methods.
 *
 * <p>Scheduled jobs run outside any request, so they get no trace id and no member id in
 * the MDC. Log enough context in the job itself to find a failed run.
 */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
