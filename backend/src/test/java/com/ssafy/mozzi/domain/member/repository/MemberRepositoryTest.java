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
        jdbcTemplate.update("delete from member");
    }

    @Test
    void savesAMemberAsPendingProfile() {
        Member saved = memberRepository.save(newMember("sub-1"));

        assertThat(saved.getId()).isNotNull();
        assertThat(saved.getStatus()).isEqualTo(MemberStatus.PENDING_PROFILE);
        assertThat(saved.getNickname()).isNull();
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

        assertThat(status).isEqualTo("PENDING_PROFILE");
    }

    @Test
    void sameGoogleAccountCannotBeStoredTwice() {
        memberRepository.saveAndFlush(newMember("sub-4"));

        assertThatThrownBy(() -> memberRepository.saveAndFlush(newMember("sub-4")))
                .isInstanceOf(DataIntegrityViolationException.class);
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

    /**
     * Re-signup inside the retention period has to see the old row (policy 9), which a
     * derived query cannot do because {@code @SQLRestriction} filters it out.
     */
    @Test
    void theWithdrawnRowIsStillReachableDeliberately() {
        Member member = memberRepository.saveAndFlush(newMember("sub-6"));
        member.withdraw(clock);
        memberRepository.saveAndFlush(member);

        assertThat(memberRepository.findIncludingWithdrawn(AuthProvider.GOOGLE.name(), "sub-6"))
                .isPresent();
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

    @Test
    void nicknameLookupIgnoresWithdrawnMembers() {
        Member member = memberRepository.saveAndFlush(newMember("sub-8"));
        member.completeOnboarding("하루");
        memberRepository.saveAndFlush(member);
        assertThat(memberRepository.existsByNicknameAndDeletedAtIsNull("하루")).isTrue();

        member.withdraw(clock);
        memberRepository.saveAndFlush(member);

        assertThat(memberRepository.existsByNicknameAndDeletedAtIsNull("하루")).isFalse();
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
        return Member.pendingProfile(providerSubject + "@gmail.com", AuthProvider.GOOGLE, providerSubject);
    }

    private static TemporalUnitOffset within1Minute() {
        return new TemporalUnitWithinOffset(1, ChronoUnit.MINUTES);
    }

}
