package com.ssafy.mozzi.global.idempotency;

import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
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
 * <p>Records expire after {@link #TTL}; an expired key counts as new.
 * {@link ExpiredIdempotencyRecordCleaner} deletes old rows once a day.
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
     * <p>Claiming the key and reading its record are two statements, and the insert that
     * finds the key taken does not lock the row. A record that expires in between can be
     * deleted — by {@link ExpiredIdempotencyRecordCleaner} or by another resend of the same
     * key — so a record that is gone by the read is treated as expired: the key is claimed
     * again and counts as new.
     *
     * @param endpoint       {@code POST /gacha/draws}; keys are scoped per member and endpoint.
     *                       Put path variables in it when the body does not carry them
     * @param request        the body, compared by hash: the same key with another body is refused
     * @param responseStatus the status the response is sent with, stored for the record
     * @throws BusinessException {@code 409 IDEMPOTENCY_CONFLICT} when the key was used with
     *                           another body
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public <T> T run(Long memberId, String endpoint, String key, Object request, int responseStatus,
            Class<T> responseType, Supplier<T> action) {
        String requestHash = SecureTokens.sha256Hex(objectMapper.writeValueAsString(request));
        if (!claim(memberId, endpoint, key, requestHash)) {
            Optional<T> replayed = replay(memberId, endpoint, key, requestHash, responseType);
            if (replayed.isPresent()) {
                return replayed.get();
            }
            if (!claim(memberId, endpoint, key, requestHash)) {
                // Another resend of the key claimed it first and has committed by now.
                return replay(memberId, endpoint, key, requestHash, responseType)
                        .orElseThrow(() -> new BusinessException(
                                CommonErrorCode.IDEMPOTENCY_CONFLICT, endpoint + " key vanished twice"));
            }
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

    /** @return {@code false} when the key is already taken by a live record */
    private boolean claim(Long memberId, String endpoint, String key, String requestHash) {
        OffsetDateTime now = OffsetDateTime.now(clock);
        jdbcTemplate.update("""
                delete from idempotency_record
                where member_id = ? and endpoint = ? and idempotency_key = ? and expires_at <= ?
                """, memberId, endpoint, key, now);
        return jdbcTemplate.update("""
                insert into idempotency_record (member_id, endpoint, idempotency_key, request_hash, status,
                                                created_at, expires_at)
                values (?, ?, ?, ?, ?, ?, ?)
                on conflict (member_id, endpoint, idempotency_key) do nothing
                """, memberId, endpoint, key, requestHash, IN_PROGRESS, now, now.plus(TTL)) == 1;
    }

    /** @return empty when the record has been deleted since the key was found taken */
    private <T> Optional<T> replay(
            Long memberId, String endpoint, String key, String requestHash, Class<T> responseType) {
        List<StoredRecord> found = jdbcTemplate.query("""
                select request_hash, status, response_body from idempotency_record
                where member_id = ? and endpoint = ? and idempotency_key = ?
                """, (rs, i) -> new StoredRecord(rs.getString(1), rs.getString(2), rs.getString(3)),
                memberId, endpoint, key);
        if (found.isEmpty()) {
            return Optional.empty();
        }
        StoredRecord stored = found.get(0);
        if (!stored.requestHash().equals(requestHash)) {
            throw new BusinessException(CommonErrorCode.IDEMPOTENCY_CONFLICT, endpoint + " key reused with another body");
        }
        // Only a committed record is visible here, and it is written complete in the same
        // transaction as its work, so IN_PROGRESS cannot be read. Checked anyway.
        if (!COMPLETED.equals(stored.status())) {
            throw new BusinessException(CommonErrorCode.IDEMPOTENCY_CONFLICT, endpoint + " key still in progress");
        }
        return Optional.of(objectMapper.readValue(stored.responseBody(), responseType));
    }

    private record StoredRecord(String requestHash, String status, String responseBody) {
    }

}
