package com.ssafy.mozzi.global.idempotency;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;

import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.repository.MemberRepository;
import com.ssafy.mozzi.support.DiaryFixtures;
import com.ssafy.mozzi.support.IntegrationTest;

@IntegrationTest
class ExpiredIdempotencyRecordCleanerTest {

    @Autowired
    private ExpiredIdempotencyRecordCleaner cleaner;

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private Long me;

    @BeforeEach
    void setUp() {
        new DiaryFixtures(jdbcTemplate).reset();
        me = memberRepository.saveAndFlush(Member.signUp("me@gmail.com", AuthProvider.GOOGLE, "me", "me")).getId();
    }

    /** A record just past its expiry is left for the grace hour; the store deletes it itself. */
    @Test
    void onlyRecordsExpiredForOverAnHourAreDeleted() {
        insertRecord("long expired", "-61 minutes");
        insertRecord("just expired", "-1 minute");
        insertRecord("live", "1 minute");

        cleaner.deleteExpired();

        assertThat(jdbcTemplate.queryForList("select idempotency_key from idempotency_record", String.class))
                .containsExactlyInAnyOrder("just expired", "live");
    }

    private void insertRecord(String key, String expiresIn) {
        jdbcTemplate.update("""
                insert into idempotency_record (member_id, endpoint, idempotency_key, request_hash, status,
                                                created_at, expires_at)
                values (?, 'POST /gacha/draws', ?, 'hash', 'COMPLETED', now(), now() + cast(? as interval))
                """, me, key, expiresIn);
    }

}
