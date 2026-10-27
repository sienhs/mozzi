package com.ssafy.mozzi.domain.member.repository;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Clock;
import java.time.OffsetDateTime;
import java.time.temporal.ChronoUnit;

import org.assertj.core.data.TemporalUnitOffset;
import org.assertj.core.data.TemporalUnitWithinOffset;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;
import com.ssafy.mozzi.domain.member.entity.MemberStatus;
import com.ssafy.mozzi.global.config.ClockConfig;
import com.ssafy.mozzi.support.IntegrationTest;

/**
 * Pins the entity and soft-delete conventions against a real PostgreSQL.
 */
@IntegrationTest
class MemberRepositoryTest {

    @Autowired
    private MemberRepository memberRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private Clock clock;

    @BeforeEach
    void reset() {
        // truncate, not delete: other tables reference member, and cascade clears them too.
        jdbcTemplate.execute("truncate table member cascade");
    }

    @Test
    void savesASignedUpMemberAsActive() {
        Member saved = memberRepository.save(newMember("sub-1"));

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getStatus()).isEqualTo(MemberStatus.ACTIVE);
        assertThat(saved.getNickname()).isEqualTo("nsub1");
    }

    /** Timestamps are filled by auditing, through the Clock bean rather than the machine clock. */
    @Test
    void auditingFillsTheTimestamps() {
        Member saved = memberRepository.saveAndFlush(newMember("sub-2"));

        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
        assertThat(saved.getCreatedAt().toInstant())
                .isCloseTo(OffsetDateTime.now(clock).toInstant(), within1Minute());
    }

    @Test
    void enumsAreStoredAsTheirNames() {
        memberRepository.saveAndFlush(newMember("sub-3"));

        String status = jdbcTemplate.queryForObject(
                "select status from member where provider_subject = 'sub-3'", String.class);

        assertThat(status).isEqualTo("ACTIVE");
    }

    @Test
    void sameGoogleAccountCannotBeActiveTwice() {
        memberRepository.saveAndFlush(newMember("sub-4"));

        assertThatThrownBy(() -> memberRepository.saveAndFlush(
                Member.signUp("other@gmail.com", AuthProvider.GOOGLE, "sub-4", "other")))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    /** Withdrawal does not block signing up again: the new account is a new row. */
    @Test
    void withdrawnGoogleAccountCanSignUpAgainAsANewMember() {
        Member first = memberRepository.saveAndFlush(newMember("sub-10"));
        first.withdraw(clock);
        memberRepository.saveAndFlush(first);

        Member second = memberRepository.saveAndFlush(newMember("sub-10"));

        assertThat(second.getId()).isNotEqualTo(first.getId());
    }

    /** {@code Alice} and {@code alice} are the same nickname, enforced by the database. */
    @Test
    void nicknamesDifferingOnlyInCaseCollide() {
        memberRepository.saveAndFlush(Member.signUp("a@gmail.com", AuthProvider.GOOGLE, "sub-11", "Alice"));

        assertThatThrownBy(() -> memberRepository.saveAndFlush(
                Member.signUp("b@gmail.com", AuthProvider.GOOGLE, "sub-12", "alice")))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(memberRepository.existsActiveNickname("alice")).isTrue();
    }

    @Test
    void nicknameIsStoredAsTyped() {
        memberRepository.saveAndFlush(Member.signUp("a@gmail.com", AuthProvider.GOOGLE, "sub-13", "Alice"));

        String nickname = jdbcTemplate.queryForObject(
                "select nickname from member where provider_subject = 'sub-13'", String.class);
        assertThat(nickname).isEqualTo("Alice");
    }

    @Test
    void derivedQueriesSkipAWithdrawnMember() {
        Member member = memberRepository.saveAndFlush(newMember("sub-5"));
        member.withdraw(clock);
        memberRepository.saveAndFlush(member);

        assertThat(memberRepository.findByProviderAndProviderSubjectAndDeletedAtIsNull(
                AuthProvider.GOOGLE, "sub-5")).isEmpty();
        assertThat(memberRepository.findByIdAndDeletedAtIsNull(member.getId())).isEmpty();
    }

    @Test
    void withdrawalKeepsTheRowAndRecordsWhen() {
        Member member = memberRepository.saveAndFlush(newMember("sub-7"));
        member.withdraw(clock);
        memberRepository.saveAndFlush(member);

        Integer rows = jdbcTemplate.queryForObject(
                "select count(*) from member where provider_subject = 'sub-7'", Integer.class);
        assertThat(rows).isEqualTo(1);
        assertThat(member.getDeletedAt()).isNotNull();
        assertThat(member.getStatus()).isEqualTo(MemberStatus.WITHDRAWN);
    }

    /** A withdrawn member's nickname is free for someone else. */
    @Test
    void nicknameLookupIgnoresWithdrawnMembers() {
        Member member = memberRepository.saveAndFlush(
                Member.signUp("haru@gmail.com", AuthProvider.GOOGLE, "sub-8", "하루"));
        assertThat(memberRepository.existsActiveNickname("하루")).isTrue();

        member.withdraw(clock);
        memberRepository.saveAndFlush(member);

        assertThat(memberRepository.existsActiveNickname("하루")).isFalse();
        memberRepository.saveAndFlush(Member.signUp("new@gmail.com", AuthProvider.GOOGLE, "sub-14", "하루"));
    }

    /**
     * On Hibernate 7, {@code @SQLRestriction} covers primary-key lookups too — the widely
     * repeated claim that {@code findById} bypasses it (true of {@code @Where} on older
     * versions) does not hold here.
     *
     * <p>The row is read back through JDBC first, so a failure cannot be mistaken for the
     * row having been deleted for real: it is still there, and Hibernate is filtering it.
     */
    @Test
    void sqlRestrictionCoversPrimaryKeyLookupsToo() {
        Member member = memberRepository.saveAndFlush(newMember("sub-9"));
        member.withdraw(clock);
        memberRepository.saveAndFlush(member);

        Integer rowsInDatabase = jdbcTemplate.queryForObject(
                "select count(*) from member where member_id = ?", Integer.class, member.getId());
        assertThat(rowsInDatabase).isEqualTo(1);

        assertThat(memberRepository.findById(member.getId())).isEmpty();
        assertThat(memberRepository.findByIdAndDeletedAtIsNull(member.getId())).isEmpty();
    }

    @Test
    void clockBeanIsOnTheServiceTimezone() {
        assertThat(clock.getZone()).isEqualTo(ClockConfig.SERVICE_ZONE);
    }

    private static Member newMember(String providerSubject) {
        // "sub-1" -> "nsub1": unique per subject and within the nickname rules.
        String nickname = "n" + providerSubject.replace("-", "");
        return Member.signUp(providerSubject + "@gmail.com", AuthProvider.GOOGLE, providerSubject, nickname);
    }

    private static TemporalUnitOffset within1Minute() {
        return new TemporalUnitWithinOffset(1, ChronoUnit.MINUTES);
    }

}
