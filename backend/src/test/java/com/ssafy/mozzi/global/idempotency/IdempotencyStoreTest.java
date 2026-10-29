package com.ssafy.mozzi.global.idempotency;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Clock;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.transaction.support.TransactionTemplate;

import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.global.security.SecureTokens;
import com.ssafy.mozzi.support.DiaryFixtures;
import com.ssafy.mozzi.support.IntegrationTest;

import tools.jackson.databind.ObjectMapper;

@IntegrationTest
class IdempotencyStoreTest {

    private static final String ENDPOINT = "POST /test";

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private TransactionTemplate transactionTemplate;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private Clock clock;

    private Long me;

    @BeforeEach
    void setUp() {
        new DiaryFixtures(jdbcTemplate).reset();
        me = memberRepository.saveAndFlush(Member.signUp("me@gmail.com", AuthProvider.GOOGLE, "me", "me")).getId();
    }

    /**
     * The key is taken by a live record when the resend claims it, and the record is gone by
     * the time the resend reads it — the cleaner, or another resend, deleted it as expired.
     * The resend then counts as new instead of failing on the missing row.
     */
    @Test
    void aRecordDeletedBeforeTheReplayCountsAsExpired() {
        Map<String, String> request = Map.of("count", "1");
        jdbcTemplate.update("""
                insert into idempotency_record (member_id, endpoint, idempotency_key, request_hash, status,
                                                response_status, response_body, created_at, completed_at, expires_at)
                values (?, ?, 'key', ?, 'COMPLETED', 201, '"first"', now(), now(), now() + interval '1 minute')
                """, me, ENDPOINT, SecureTokens.sha256Hex(objectMapper.writeValueAsString(request)));
        IdempotencyStore store = new IdempotencyStore(deletingBeforeFirstRead(), objectMapper, clock);
        AtomicInteger runs = new AtomicInteger();

        String response = transactionTemplate.execute(status -> store.run(me, ENDPOINT, "key", request, 201,
                String.class, () -> "second #" + runs.incrementAndGet()));

        assertThat(response).isEqualTo("second #1");
        assertThat(jdbcTemplate.queryForObject(
                "select response_body from idempotency_record where idempotency_key = 'key'", String.class))
                .isEqualTo("\"second #1\"");
    }

    /** Deletes every record just before the first query, on the caller's connection. */
    private JdbcTemplate deletingBeforeFirstRead() {
        return new JdbcTemplate(jdbcTemplate.getDataSource()) {
            private boolean deleted;

            @Override
            public <T> List<T> query(String sql, RowMapper<T> rowMapper, Object... args) {
                if (!deleted) {
                    deleted = true;
                    update("delete from idempotency_record");
                }
                return super.query(sql, rowMapper, args);
            }
        };
    }

}
