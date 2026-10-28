package com.ssafy.mozzi.domain.search.repository;

import java.time.OffsetDateTime;
import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.mozzi.domain.search.entity.EmotionSearch;

/** Both lookups run on {@code ix_emotion_search_member_created_at}. */
public interface EmotionSearchRepository extends JpaRepository<EmotionSearch, Long> {

    /** The per-minute limit. */
    long countByMemberIdAndCreatedAtAfter(Long memberId, OffsetDateTime after);

    /** This week's searches, for the weekly context. */
    List<EmotionSearch> findByMemberIdAndCreatedAtGreaterThanEqualOrderByCreatedAt(
            Long memberId, OffsetDateTime since);

    /**
     * Retention (API decision #5). Run after {@link EmotionSearchResultRepository#deleteCreatedBefore},
     * whose rows reference these; the schema has no cascade.
     */
    @Modifying
    @Query("delete from EmotionSearch s where s.createdAt < :cutoff")
    int deleteCreatedBefore(@Param("cutoff") OffsetDateTime cutoff);

}
