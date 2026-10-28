package com.ssafy.mozzi.domain.search.repository;

import java.time.OffsetDateTime;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import com.ssafy.mozzi.domain.search.entity.EmotionSearchResult;
import com.ssafy.mozzi.domain.search.entity.EmotionSearchResultId;

public interface EmotionSearchResultRepository extends JpaRepository<EmotionSearchResult, EmotionSearchResultId> {

    /** The rows of searches {@link EmotionSearchRepository#deleteCreatedBefore} is about to remove. */
    @Modifying
    @Query("""
            delete from EmotionSearchResult r
            where r.id.emotionSearchId in (select s.id from EmotionSearch s where s.createdAt < :cutoff)
            """)
    int deleteCreatedBefore(@Param("cutoff") OffsetDateTime cutoff);

}
