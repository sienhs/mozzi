package com.ssafy.mozzi.global.idempotency;

import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Deletes expired {@code idempotency_record} rows once a day.
 *
 * <p>Housekeeping only: {@link IdempotencyStore} already treats an expired key as new, so
 * nothing depends on this having run. Each pod runs it; the delete is idempotent.
 *
 * <p>Rows are left for {@link #GRACE} past their expiry, so the cleaner stays clear of a
 * resend that found the record live a moment before it expired. The store copes with the
 * record vanishing anyway; this keeps the cleaner from being one of the ways it does.
 */
@Component
public class ExpiredIdempotencyRecordCleaner {

    private static final Logger log = LoggerFactory.getLogger(ExpiredIdempotencyRecordCleaner.class);

    static final Duration GRACE = Duration.ofHours(1);

    private final JdbcTemplate jdbcTemplate;
    private final Clock clock;

    public ExpiredIdempotencyRecordCleaner(JdbcTemplate jdbcTemplate, Clock clock) {
        this.jdbcTemplate = jdbcTemplate;
        this.clock = clock;
    }

    @Scheduled(cron = "0 50 4 * * *", zone = "Asia/Seoul")
    public void deleteExpired() {
        int records = jdbcTemplate.update(
                "delete from idempotency_record where expires_at <= ?", OffsetDateTime.now(clock).minus(GRACE));
        log.info("expired idempotency records deleted: records={}", records);
    }

}
