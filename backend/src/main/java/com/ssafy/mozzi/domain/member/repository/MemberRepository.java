package com.ssafy.mozzi.domain.member.repository;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;
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
 * spell out {@code DeletedAtIsNull} so the intent is visible where the query is called, and
 * so removing the annotation from an entity cannot silently widen a lookup.
 *
 * <p>Because the restriction applies everywhere, reaching a withdrawn row needs a native
 * query — see {@link #findIncludingWithdrawn}.
 */
public interface MemberRepository extends JpaRepository<Member, Long> {

    Optional<Member> findByIdAndDeletedAtIsNull(Long id);

    Optional<Member> findByProviderAndProviderSubjectAndDeletedAtIsNull(
            AuthProvider provider, String providerSubject);

    /**
     * Includes withdrawn members on purpose: re-signup inside the retention period has to
     * find the old row to apply policy 9, and the unique index would reject inserting a
     * second one anyway.
     *
     * <p>Native, because {@code @SQLRestriction} is appended to every generated query — a
     * derived method here would be silently filtered and always come back empty.
     */
    @Query(value = """
            select *
            from member
            where provider = :provider
              and provider_subject = :providerSubject
            """, nativeQuery = true)
    Optional<Member> findIncludingWithdrawn(
            @Param("provider") String provider, @Param("providerSubject") String providerSubject);

    boolean existsByNicknameAndDeletedAtIsNull(String nickname);

}
