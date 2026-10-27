package com.ssafy.mozzi.domain.auth.repository;

import java.time.OffsetDateTime;
import java.util.Optional;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.mozzi.domain.auth.entity.MemberSession;
import com.ssafy.mozzi.domain.member.entity.MemberStatus;

public interface MemberSessionRepository extends JpaRepository<MemberSession, Long> {

    Optional<MemberSession> findBySessionId(UUID sessionId);

    /**
     * The per-request check: is this the member's current, unexpired session, and is the
     * member still active. One indexed lookup that loads neither entity.
     */
    @Query("""
            select case when count(s) > 0 then true else false end
            from MemberSession s, Member m
            where m.id = s.memberId
              and s.memberId = :memberId
              and s.sessionId = :sessionId
              and s.refreshExpiresAt > :now
              and m.deletedAt is null
              and m.status = :active
            """)
    boolean existsCurrent(@Param("memberId") Long memberId, @Param("sessionId") UUID sessionId,
            @Param("now") OffsetDateTime now, @Param("active") MemberStatus active);

    /**
     * Swaps in a new refresh token, but only if the old one is still the current, unexpired
     * one.
     *
     * <p>The conditions are the guard, not an earlier read: two refreshes with the same
     * token both pass the read, and only the first update still finds the old hash. Bulk
     * JPQL skips auditing, hence the explicit {@code updatedAt}.
     *
     * @return 1 if rotated, 0 if the token was already rotated, replaced by a new login,
     *         or expired
     */
    @Modifying
    @Query("""
            update MemberSession s
            set s.refreshTokenHash = :newHash,
                s.refreshExpiresAt = :newExpiresAt,
                s.updatedAt = :now
            where s.memberId = :memberId
              and s.sessionId = :sessionId
              and s.refreshTokenHash = :oldHash
              and s.refreshExpiresAt > :now
            """)
    int rotate(@Param("memberId") Long memberId, @Param("sessionId") UUID sessionId,
            @Param("oldHash") String oldHash, @Param("newHash") String newHash,
            @Param("newExpiresAt") OffsetDateTime newExpiresAt, @Param("now") OffsetDateTime now);

    /**
     * Bulk delete, which runs immediately. A new login inserts the same primary key right
     * after; with {@code deleteById} Hibernate would flush the insert before the delete.
     */
    @Modifying
    @Query("delete from MemberSession s where s.memberId = :memberId")
    int deleteAllOfMember(@Param("memberId") Long memberId);

    /**
     * Logout. Matching the session id too means a late logout from a device that has
     * already been signed out cannot end the newer session.
     */
    @Modifying
    @Query("delete from MemberSession s where s.memberId = :memberId and s.sessionId = :sessionId")
    int deleteSession(@Param("memberId") Long memberId, @Param("sessionId") UUID sessionId);

    /**
     * The condition sits in the delete itself, so a session refreshed after a cleanup run
     * started is not removed — which reading ids first and deleting them later would do.
     */
    @Modifying
    @Query("delete from MemberSession s where s.refreshExpiresAt <= :cutoff")
    int deleteExpired(@Param("cutoff") OffsetDateTime cutoff);

}
