package com.ssafy.mozzi.global.idempotency;

import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.function.Supplier;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import com.ssafy.mozzi.global.exception.BusinessException;
import com.ssafy.mozzi.global.exception.CommonErrorCode;
import com.ssafy.mozzi.global.security.SecureTokens;

import tools.jackson.databind.ObjectMapper;

/**
 * Replays the first response for a repeated {@code Idempotency-Key} (ERD
 * {@code idempotency_record}).
 *
 * <p>The record is written in the caller's transaction, before the work it guards. A resend
 * of a request still running blocks on the unique index until the first one ends: if it
 * committed, the resend finds the stored response; if it rolled back, the record went with it
 * and the resend does the work itself. Failures are therefore never stored, and a member who
 * was refused for lack of tickets can retry with the same key.
 *
 * <p>Records expire after {@link #TTL}; an expired key counts as new. Nothing deletes old
 * rows yet.
 */
@Component
public class IdempotencyStore {

    public static final String HEADER = "Idempotency-Key";

    static final Duration TTL = Duration.ofHours(24);

    private static final String IN_PROGRESS = "IN_PROGRESS";
    private static final String COMPLETED = "COMPLETED";

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final Clock clock;

    public IdempotencyStore(JdbcTemplate jdbcTemplate, ObjectMapper objectMapper, Clock clock) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.clock = clock;
    }

    /**
     * Runs {@code action} once per key, or returns what its first run returned.
     *
     * @param endpoint       {@code POST /gacha/draws}; keys are scoped per member and endpoint
     * @param request        the body, compared by hash: the same key with another body is refused
     * @param responseStatus the status the response is sent with, stored for the record
     * @throws BusinessException {@code 409 IDEMPOTENCY_CONFLICT} when the key was used with
     *                           another body
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public <T> T run(Long memberId, String endpoint, String key, Object request, int responseStatus,
            Class<T> responseType, Supplier<T> action) {
        String requestHash = SecureTokens.sha256Hex(objectMapper.writeValueAsString(request));
        OffsetDateTime now = OffsetDateTime.now(clock);

        jdbcTemplate.update("""
                delete from idempotency_record
                where member_id = ? and endpoint = ? and idempotency_key = ? and expires_at <= ?
                """, memberId, endpoint, key, now);
        int inserted = jdbcTemplate.update("""
                insert into idempotency_record (member_id, endpoint, idempotency_key, request_hash, status,
                                                created_at, expires_at)
                values (?, ?, ?, ?, ?, ?, ?)
                on conflict (member_id, endpoint, idempotency_key) do nothing
                """, memberId, endpoint, key, requestHash, IN_PROGRESS, now, now.plus(TTL));
        if (inserted == 0) {
            return replay(memberId, endpoint, key, requestHash, responseType);
        }

        T response = action.get();
        jdbcTemplate.update("""
                update idempotency_record
                set status = ?, response_status = ?, response_body = ?, completed_at = ?
                where member_id = ? and endpoint = ? and idempotency_key = ?
                """, COMPLETED, responseStatus, objectMapper.writeValueAsString(response), OffsetDateTime.now(clock),
                memberId, endpoint, key);
        return response;
    }

    private <T> T replay(Long memberId, String endpoint, String key, String requestHash, Class<T> responseType) {
        StoredRecord stored = jdbcTemplate.queryForObject("""
                select request_hash, status, response_body from idempotency_record
                where member_id = ? and endpoint = ? and idempotency_key = ?
                """, (rs, i) -> new StoredRecord(rs.getString(1), rs.getString(2), rs.getString(3)),
                memberId, endpoint, key);
        if (!stored.requestHash().equals(requestHash)) {
            throw new BusinessException(CommonErrorCode.IDEMPOTENCY_CONFLICT, endpoint + " key reused with another body");
        }
        // Only a committed record is visible here, and it is written complete in the same
        // transaction as its work, so IN_PROGRESS cannot be read. Checked anyway.
        if (!COMPLETED.equals(stored.status())) {
            throw new BusinessException(CommonErrorCode.IDEMPOTENCY_CONFLICT, endpoint + " key still in progress");
        }
        return objectMapper.readValue(stored.responseBody(), responseType);
    }

    private record StoredRecord(String requestHash, String status, String responseBody) {
    }

}
