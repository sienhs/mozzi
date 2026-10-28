package com.ssafy.mozzi.global.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;

/**
 * Turns on {@code @Async} methods, which run on Boot's {@code applicationTaskExecutor}.
 *
 * <p>Do not declare an {@code Executor} bean of your own: Boot then backs off and stops
 * creating {@code applicationTaskExecutor}, and every {@code @Async} method moves to the
 * new bean without anyone noticing.
 *
 * <p>Async methods run outside the request, so they get no trace id and no member id in
 * the MDC, like scheduled jobs (see {@link SchedulingConfig}).
 */
@Configuration
@EnableAsync
public class AsyncConfig {
}
