package com.ssafy.mozzi.domain.member.repository;

import java.time.OffsetDateTime;
import java.util.Optional;
import jakarta.persistence.LockModeType;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.mozzi.domain.member.entity.AuthProvider;
import com.ssafy.mozzi.domain.member.entity.Member;

/**
 * Reference implementation of the soft-delete lookup convention.
 *
 * <p>The {@code @SQLRestriction} on {@link Member} already hides withdrawn members from
 * every read, primary-key lookups included ({@code MemberRepositoryTest} pins this — the
 * common claim that {@code findById} escapes it is not true on Hibernate 7). Reads still
 * spell out {@code deletedAt is null} so the intent is visible where the query is called, and
 * so removing the annotation from an entity cannot silently widen a lookup.
 */
public interface MemberRepository extends JpaRepository<Member, Long> {

    Optional<Member> findByIdAndDeletedAtIsNull(Long id);

    Optional<Member> findByProviderAndProviderSubjectAndDeletedAtIsNull(
            AuthProvider provider, String providerSubject);

    /**
     * {@code SELECT ... FOR UPDATE} on the member row.
     *
     * <p>Login, refresh, logout and withdrawal all take this lock before touching the
     * member's session. Locking the session row instead would not work: a member who is not
     * logged in has no session row to lock, so two first logins would not wait for each other.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from Member m where m.id = :id and m.deletedAt is null")
    Optional<Member> findActiveByIdForUpdate(@Param("id") Long id);

    /** Same lock as {@link #findActiveByIdForUpdate}, for a login that only knows the Google identity. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select m from Member m
            where m.provider = :provider
              and m.providerSubject = :providerSubject
              and m.deletedAt is null
            """)
    Optional<Member> findActiveByProviderSubjectForUpdate(
            @Param("provider") AuthProvider provider, @Param("providerSubject") String providerSubject);

    boolean existsByProviderAndProviderSubjectAndDeletedAtIsNull(AuthProvider provider, String providerSubject);

    /**
     * Matches the unique index on {@code lower(nickname)}, so the check and the constraint
     * agree on what a duplicate is.
     *
     * @param comparisonKey see {@link com.ssafy.mozzi.domain.member.entity.Nickname#comparisonKey}
     */
    @Query("""
            select case when count(m) > 0 then true else false end
            from Member m
            where lower(m.nickname) = :comparisonKey
              and m.deletedAt is null
            """)
    boolean existsActiveNickname(@Param("comparisonKey") String comparisonKey);

    /**
     * Creates the member's settings row with the schema defaults (reminder on at 21:00,
     * Asia/Seoul).
     *
     * <p>Native, so the defaults have one home — the migration — rather than being repeated
     * in an entity that nothing else reads yet.
     */
    @Modifying
    @Query(value = "insert into member_setting (member_id, updated_at) values (:memberId, :now)",
            nativeQuery = true)
    void insertDefaultSetting(@Param("memberId") Long memberId, @Param("now") OffsetDateTime now);

}
